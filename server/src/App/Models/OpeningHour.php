<?php
declare(strict_types=1);

namespace Loxya\Models;

use Adbar\Dot as DotArray;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Loxya\Contracts\Serializable;
use Loxya\Models\Traits\Serializer;
use Loxya\Support\Validation\Validator as V;

/**
 * Heures d'ouverture globale.
 *
 * @property-read ?int $id
 * @property int $weekday
 * @property string $start_time
 * @property string $end_time
 */
final class OpeningHour extends BaseModel implements Serializable
{
    use Serializer;

    public $timestamps = false;

    protected $table = 'opening_hours';

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);

        $this->validation = fn () => [
            'weekday' => V::custom([$this, 'checkWeekDay']),
            'start_time' => V::custom([$this, 'checkStartTime']),
            'end_time' => V::custom([$this, 'checkEndTime']),
        ];
    }

    // ------------------------------------------------------
    // -
    // -    Validation
    // -
    // ------------------------------------------------------

    public function checkWeekDay($value)
    {
        return V::create()
            ->intVal()
            ->between(0, 6)
            ->validate($value);
    }

    public function checkStartTime($value)
    {
        $timeChecker = V::anyOf(V::time('H:i:s'), V::equals('24:00:00'));
        if (!$timeChecker->validate($value)) {
            return false;
        }

        $now = CarbonImmutable::now();
        $startTimeDate = $now->setTimeFromTimeString($value);

        // - La date doit être arrondie à la demi-heure le plus proche.
        if (!$startTimeDate->roundMinutes(15)->eq($startTimeDate)) {
            return 'time-precision-must-be-quarter';
        }

        $endTimeRaw = $this->getAttributeUnsafeValue('end_time');
        if (!$timeChecker->validate($endTimeRaw)) {
            return true;
        }

        $endTimeDate = $now->setTimeFromTimeString($endTimeRaw);

        // - On vérifie que l'heure de fin est bien après l'heure de début.
        if (!$endTimeDate->isAfter($startTimeDate)) {
            return 'end-time-must-be-after-start-time';
        }

        $weekdayRaw = $this->getAttributeUnsafeValue('weekday');
        if (!($this->validation)()['weekday']->validate($weekdayRaw)) {
            return true;
        }

        $hasConflict = static::query()
            ->where('weekday', (int) $weekdayRaw)
            ->whereTime('start_time', '<', $endTimeDate)
            ->whereTime('end_time', '>', $startTimeDate)
            ->when($this->exists, fn (Builder $subQuery) => (
                $subQuery->where('id', '!=', $this->id)
            ))
            ->exists();

        return !$hasConflict ?: 'period-conflict-with-existing-one';
    }

    public function checkEndTime($value)
    {
        $timeChecker = V::anyOf(V::time('H:i:s'), V::equals('24:00:00'));
        if (!$timeChecker->validate($value)) {
            return false;
        }

        $now = CarbonImmutable::now();
        $endTimeDate = $now->setTimeFromTimeString($value);

        // - La date doit être arrondie à la demi-heure le plus proche.
        if (!$endTimeDate->roundMinutes(15)->eq($endTimeDate)) {
            return 'time-precision-must-be-quarter';
        }

        $startTimeRaw = $this->getAttributeUnsafeValue('start_time');
        if (!$timeChecker->validate($startTimeRaw)) {
            return true;
        }

        $startTimeDate = $now->setTimeFromTimeString($startTimeRaw);

        // - On vérifie que l'heure de fin est bien après l'heure de début.
        if (!$endTimeDate->isAfter($startTimeDate)) {
            return 'end-time-must-be-after-start-time';
        }

        $weekdayRaw = $this->getAttributeUnsafeValue('weekday');
        if (!($this->validation)()['weekday']->validate($weekdayRaw)) {
            return true;
        }

        $hasConflict = static::query()
            ->where('weekday', (int) $weekdayRaw)
            ->whereTime('start_time', '<', $endTimeDate)
            ->whereTime('end_time', '>', $startTimeDate)
            ->when($this->exists, fn (Builder $subQuery) => (
                $subQuery->where('id', '!=', $this->id)
            ))
            ->exists();

        return !$hasConflict ?: 'period-conflict-with-existing-one';
    }

    // ------------------------------------------------------
    // -
    // -    Mutators
    // -
    // ------------------------------------------------------

    protected $casts = [
        'weekday' => 'integer',
        'start_time' => 'string',
        'end_time' => 'string',
    ];

    // ------------------------------------------------------
    // -
    // -    Setters
    // -
    // ------------------------------------------------------

    protected $fillable = [
        'weekday',
        'start_time',
        'end_time',
    ];

    // ------------------------------------------------------
    // -
    // -    Méthodes utilitaires
    // -
    // ------------------------------------------------------

    /**
     * Permet de savoir si l'établissement est ouvert à la date donnée.
     *
     * Si l'établissement ouvre ne serait-ce qu'une heure, l'établissement
     * est considéré comme ouvrant à la date donnée.
     *
     * @param CarbonInterface $date La date pour laquelle on veut vérifier l'ouverture.
     *
     * @return bool `true` si l'établissement est ouvert ce jour, `false` sinon.
     */
    public static function isOpenDay(CarbonInterface $date): bool
    {
        return static::query()
            ->where('weekday', (int) $date->format('w'))
            ->exists();
    }

    /**
     * Permet de savoir si l'établissement est ouvert à l'heure donnée, le jour donné.
     *
     * S'il s'avère que l'heure vérifiée est minuit (`00:00:00`) et que l'établissement
     * est ouvert la veille jusqu'à cette heure (= `24:00:00`), l'établissement sera
     * considéré ouvert, même s'il n'est pas marqué comme ouvert ce jour précis à `00:00:00`.
     * (Vu que: la veille à `24:00:00` === le lendemain à `00:00:00`)
     *
     * @param CarbonInterface $date La date / heure pour laquelle on veut vérifier l'ouverture.
     *
     * @return bool `true` si l'établissement est ouvert à cette heure ce jour là, `false` sinon.
     */
    public static function isOpen(CarbonInterface $date): bool
    {
        $query = static::query()
            ->where(static function (Builder $subQuery) use ($date) {
                $subQuery
                    ->where('weekday', (int) $date->format('w'))
                    ->whereTime('start_time', '<=', $date)
                    ->whereTime('end_time', '>=', $date);
            });

        if ($date->isStartOfDay()) {
            $query->orWhere(static function (Builder $subQuery) use ($date) {
                $prevDay = $date->toImmutable()->subDay();

                $subQuery
                    ->where('weekday', (int) $prevDay->format('w'))
                    ->whereTime('end_time', '24:00:00');
            });
        }

        return $query->exists();
    }

    // ------------------------------------------------------
    // -
    // -    Serialization
    // -
    // ------------------------------------------------------

    public function serialize(): array
    {
        return (new DotArray($this->attributesForSerialization()))
            ->delete(['id'])
            ->all();
    }
}
