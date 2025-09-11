<?php
declare(strict_types=1);

namespace Loxya\Support;

use Carbon\CarbonImmutable;
use DateTimeInterface;
use Eluceo\iCal\Domain\ValueObject\Date as CalendarDate;
use Eluceo\iCal\Domain\ValueObject\DateTime as CalendarDateTime;
use Eluceo\iCal\Domain\ValueObject\MultiDay as CalendarMultiDay;
use Eluceo\iCal\Domain\ValueObject\Occurrence as CalendarOccurrence;
use Eluceo\iCal\Domain\ValueObject\SingleDay as CalendarSingleDay;
use Eluceo\iCal\Domain\ValueObject\TimeSpan as CalendarTimeSpan;
use Illuminate\Contracts\Support\Arrayable;
use Loxya\Contracts\PeriodInterface;
use Loxya\Support\Validation\Validator as V;

/** Une période. */
final class Period implements PeriodInterface, Arrayable, \JsonSerializable
{
    /** La date de début de la période. */
    private CarbonImmutable $start;

    /** La date de fin de la période. */
    private CarbonImmutable|null $end;

    /** La période est-t'elle du type "journées entières" ? */
    private bool $isFullDays;

    /**
     * @param string|PeriodInterface|\DateTimeInterface $start
     * @param string|\DateTimeInterface|null $end
     * @param bool $isFullDays
     */
    public function __construct($start, $end = null, bool $isFullDays = false)
    {
        if ($start instanceof PeriodInterface) {
            if ($start instanceof Period) {
                $isFullDays = $start->isFullDays();
            }
            $end = $start->getEndDate() ?? null;
            $start = $start->getStartDate();
        }

        $normalizedStart = CarbonImmutable::parse($start);
        $normalizedEnd = $end !== null
            ? CarbonImmutable::parse($end)
            : $end;

        if ($isFullDays) {
            $normalizedStart = $normalizedStart->startOfDay();

            // - Si l'heure de la date de fin n'est pas `00:00:00` ou si le format passé ne
            //   contenait pas l'heure, on ajuste la date de fin en lui ajoutant une journée.
            $needsDayAdjustment = (
                $normalizedEnd !== null &&
                (
                    (is_string($end) && date_parse($end)['hour'] === false) ||
                    $normalizedEnd->format('H:i:s') !== '00:00:00'
                )
            );
            if ($needsDayAdjustment) {
                $normalizedEnd = $normalizedEnd
                    ->addDay()
                    ->startOfDay();
            }
        }

        Assert::true(
            $normalizedEnd === null || $normalizedEnd->gte($normalizedStart),
            'End date should be after start date.',
        );

        $this->start = $normalizedStart;
        $this->end = $normalizedEnd;
        $this->isFullDays = $isFullDays;
    }

    public function getStartDate(): CarbonImmutable
    {
        return $this->start;
    }

    public function getEndDate(): CarbonImmutable|null
    {
        return $this->end;
    }

    /**
     * La période est-t'elle du type "journées entières" ?
     *
     * @return bool `true` si la période est du type "journées entières", `false` sinon.
     */
    public function isFullDays(): bool
    {
        return $this->isFullDays;
    }

    /**
     * Retourne le nombre de jours de la période.
     *
     * Toute journée commencée est comptabilisée (même si la date de fin se termine à 00:01).
     *
     * @return int Le nombre de jours de la période.
     *
     * @throws \LogicException If the period is infinite.
     */
    public function asDays(): int
    {
        if ($this->isInfinite()) {
            throw new \LogicException('Cannot retrieve the number of days of a infinite period.');
        }

        $endDate = $this->getEndDate();
        if ($endDate->format('H:i:s') !== '00:00:00') {
            $endDate = $endDate
                ->add(new \DateInterval('P1D'))
                ->startOfDay();
        }

        $startDate = $this->getStartDate()->startOfDay();
        return max($startDate->diffInDays($endDate), 1);
    }

    /**
     * Retourne le nombre d'heures de la période.
     *
     * Toute heure commencée est comptabilisée (même si l'heure de fin se termine à xx:01).
     *
     * @return int Le nombre d'heure de la période.
     *
     * @throws \LogicException If the period is infinite.
     */
    public function asHours(): int
    {
        if ($this->isInfinite()) {
            throw new \LogicException('Cannot retrieve the number of hours of a infinite period.');
        }

        $endDate = $this->getEndDate();
        if ($endDate->format('i:s') !== '00:00') {
            $endDate = $endDate
                ->add(new \DateInterval('PT1H'))
                ->startOfHour();
        }

        $startDate = $this->getStartDate()->startOfHour();
        return max($startDate->diffInHours($endDate), 1);
    }

    /**
     * Vérifie si la période courante "contient" une autre période.
     *
     * @param PeriodInterface $otherPeriod L'autre période à comparer.
     */
    public function contain(PeriodInterface $otherPeriod): bool
    {
        $otherPeriod = new static($otherPeriod);

        // - Si la présente période ne commence pas avant
        //   l'autre, elle ne peut pas la contenir.
        if ($this->getStartDate() > $otherPeriod->getStartDate()) {
            return false;
        }

        return (
            // - Si la présente période est infinie, que l'autre le soit aussi ou non,
            //   vu que la présente période commence avant, elle la contient.
            $this->isInfinite() ||

            // - Sinon il faut que la date de fin de la présente période soit après
            //   (ou identique) à la date de fin de l'autre.
            (!$otherPeriod->isInfinite() && $this->getEndDate() >= $otherPeriod->getEndDate())
        );
    }

    /**
     * Vérifie si la période courante "chevauche" une autre période.
     *
     * @param PeriodInterface $otherPeriod L'autre période à comparer.
     */
    public function overlaps(PeriodInterface $otherPeriod): bool
    {
        $otherPeriod = new static($otherPeriod);

        // - Si les deux périodes sont infinies, elles se chevauchent forcément.
        if ($this->isInfinite() && $otherPeriod->isInfinite()) {
            return true;
        }

        // - Si la présente période est infinie, pour chevaucher l'autre,
        //   elle doit commencer avant la fin de l'autre.
        if ($this->isInfinite()) {
            return $this->getStartDate() < $otherPeriod->getEndDate();
        }

        // - Si l'autre période est infinie, pour chevaucher que la présente
        //   période la chevauche, elle doit se terminer après le début de l'autre.
        if ($otherPeriod->isInfinite()) {
            return $this->getEndDate() > $otherPeriod->getStartDate();
        }

        // - Sinon, elle doit commencer avant la fin de l'autre et
        //   se terminer après son début.
        return (
            $this->getStartDate() < $otherPeriod->getEndDate() &&
            $this->getEndDate() > $otherPeriod->getStartDate()
        );
    }

    /**
     * Fusionne la période courante avec une autre et retourne la période résultante.
     *
     * @param static $otherPeriod La période avec laquelle il faut fusionner.
     */
    public function merge(PeriodInterface $otherPeriod): static
    {
        $otherPeriod = new static($otherPeriod);

        $startDate = $this->getStartDate() <= $otherPeriod->getStartDate()
            ? $this->getStartDate()
            : $otherPeriod->getStartDate();

        $endDate = null;
        if (!$this->isInfinite() && !$otherPeriod->isInfinite()) {
            $endDate = $this->getEndDate() >= $otherPeriod->getEndDate()
                ? $this->getEndDate()
                : $otherPeriod->getEndDate();
        }

        return new static($startDate, $endDate);
    }

    /**
     * Vérifie qu'une période est équivalente à une autre.
     *
     * @param PeriodInterface $otherPeriod L'autre période à comparer à celle-ci.
     *
     * @return bool `true` si les périodes sont équivalentes, `false` sinon.
     */
    public function isSame(PeriodInterface $otherPeriod): bool
    {
        $otherPeriod = new static($otherPeriod);

        // - Si les dates de départ ne sont pas identiques, on ne va pas plus loin.
        if (!$this->getStartDate()->equalTo($otherPeriod->getStartDate())) {
            return false;
        }

        // - Si les deux périodes sont infinies, elles sont identiques,
        //   sinon on vérifie que les deux dates de fin correspondent.
        return !$this->isInfinite() && !$otherPeriod->isInfinite()
            ? $this->getEndDate()->equalTo($otherPeriod->getEndDate())
            : $this->isInfinite() && $otherPeriod->isInfinite();
    }

    /**
     * Permet de déterminer si la période est passée.
     *
     * @return bool `true` si la période est passée, `false` sinon.
     */
    public function isPast(): bool
    {
        // Note: On vérifie que la fin est avant ou maintenant (donc pas dans le future)
        //       car l'instant que représente `$this->end` est déjà en dehors de la période.
        return !$this->isInfinite() && !$this->end->isFuture();
    }

    /**
     * Permet de déterminer si la période est passée ou en cours.
     *
     * @return bool `true` si la période est passée ou en cours, `false` sinon.
     */
    public function isPastOrOngoing(): bool
    {
        return $this->start->isPast();
    }

    /**
     * Indique si la période courante est infinie (pas de date de fin) ou non.
     *
     * @return bool `true` si la période est infinie, `false` sinon.
     */
    public function isInfinite(): bool
    {
        return $this->end === null;
    }

    /**
     * Permet de récupérer les périodes entourant une période
     * par rapport à une autre.
     *
     * @param PeriodInterface $otherPeriod L'autre période.
     *
     * @return array<'pre'|'post', Period> Un tableau avec les clés suivantes:
     *                                     - `pre`: Contient la période entre le début de
     *                                        la présente période et l'autre période
     *                                        (ou `null` si inexistante).
     *                                     - `post`: Contient la période entre la fin de
     *                                        la présente période et l'autre période
     *                                        (ou `null` si inexistante).
     */
    public function surroundingPeriods(PeriodInterface $otherPeriod): array
    {
        $otherPeriod = new static($otherPeriod);

        $prePeriod = $this->getStartDate()->isBefore($otherPeriod->getStartDate())
            ? new static($this->getStartDate(), $otherPeriod->getStartDate())
            : null;

        $postPeriod = null;
        if (!$otherPeriod->isInfinite()) {
            $postPeriod = $this->isInfinite() || $this->getEndDate()->isAfter($otherPeriod->getEndDate())
                ? new static($otherPeriod->getEndDate(), $this->getEndDate())
                : null;
        }

        return ['pre' => $prePeriod, 'post' => $postPeriod];
    }

    /**
     * Retourne une copie de la période avec la configuration des jours
     * entiers modifiée en fonction du paramètre passé.
     *
     * @param bool $inFullDays La nouvelle période doit-elle être du type "journées entières" ?
     * @param bool $midday En passant en période à l'heure près, dois-t'on ajuster les heures
     *                     à midi plutôt que mettre à minuit le jour de début et de fin ?
     *
     * @return static Une copie de la présente période avec la configuration "journées entières" modifiée.
     */
    public function setFullDays(bool $inFullDays, bool $midday = false): static
    {
        if ($inFullDays) {
            if ($this->isFullDays) {
                return $this;
            }
            return new static($this->start, $this->end, isFullDays: true);
        }

        if (!$this->isFullDays) {
            return $this;
        }

        return new Period(
            !$midday ? $this->start : $this->start->hour(12),
            !$midday ? $this->end : $this->end->subDay()->hour(12),
            isFullDays: false,
        );
    }

    /**
     * Permet de récupérer la période sous forme de tableau serializable.
     *
     * @return array La période sous forme de tableau.
     */
    public function toArray(): array
    {
        if ($this->isFullDays()) {
            return [
                'isFullDays' => true,
                'start' => $this->getStartDate()->format('Y-m-d'),
                'end' => $this->getEndDate()?->subDay()->format('Y-m-d'),
            ];
        }

        return [
            'isFullDays' => false,
            'start' => $this->getStartDate()->format('Y-m-d H:i:s'),
            'end' => $this->getEndDate()?->format('Y-m-d H:i:s'),
        ];
    }

    /**
     * Permet de récupérer la période sous forme d'occurrence compatibles
     * avec la génération d'un calendrier iCal.
     *
     * @return CalendarOccurrence La période sous forme d'occurrence de calendrier.
     *
     * @throws \LogicException Si la période est infinie.
     */
    public function toCalendarOccurrence(): CalendarOccurrence
    {
        if ($this->isInfinite()) {
            throw new \LogicException('Cannot convert an infinite period to a calendar occurrence.');
        }

        if ($this->isFullDays()) {
            $isOneDayPeriod = $this->getStartDate()->isSameDay(
                $this->getEndDate()->subDay(),
            );
            if ($isOneDayPeriod) {
                return new CalendarSingleDay(
                    new CalendarDate($this->getStartDate()),
                );
            }

            return new CalendarMultiDay(
                new CalendarDate($this->getStartDate()),
                new CalendarDate($this->getEndDate()->subDay()),
            );
        }

        return new CalendarTimeSpan(
            new CalendarDateTime($this->getStartDate(), false),
            new CalendarDateTime($this->getEndDate(), false),
        );
    }

    /**
     * Permet de récupérer la période sous forme d'une entité serializable en JSON.
     *
     * @return array La période sous forme d'une serializable JSON.
     */
    public function jsonSerialize(): mixed
    {
        return $this->toArray();
    }

    // ------------------------------------------------------
    // -
    // -    Méthodes utilitaires.
    // -
    // ------------------------------------------------------

    /**
     * Permet de récupérer une période depuis une valeur mixte ou `null`
     * si la valeur n'a pas pû être convertie en période.
     *
     * @param mixed $value La valeur à convertir en période.
     *
     * @return static|null La période résultant ou `null` si elle n'a pas pû être récupérée.
     */
    public static function tryFrom(mixed $value): static|null
    {
        try {
            return static::from($value);
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * Permet de récupérer une période depuis une valeur mixte.
     *
     * @param mixed $value La valeur à convertir en période.
     *
     * @return static La période résultant.
     *
     * @throws \InvalidArgumentException Si la valeur n'a pas pû être convertie en période.
     */
    public static function from(mixed $value): static
    {
        if ($value instanceof PeriodInterface) {
            return new static($value);
        }

        if (is_array($value)) {
            return static::fromArray($value);
        }

        throw new \InvalidArgumentException("The value cannot be converted into a period.");
    }

    /**
     * Permet de récupérer une période depuis un tableau de dates.
     *
     * @param array $array Le tableau à convertir en période, deux formats sont acceptés:
     *                     - Soit `['start' => '[Date début]', 'end' => '[Date fin]']`.
     *                     - Soit `['start' => '[Date début]', 'end' => null]`.
     *                     - Soit `['start' => '[Date début]', 'end' => '[Date fin]', 'isFullDays' => true|false]`.
     *                     - Soit `['start' => '[Date début]', 'end' => null, 'isFullDays' => true|false]`.
     *                     - Soit `['[Date début]', '[Date fin]']`.
     *                     - Soit `['[Date début]', null]`.
     *
     * @return static La période équivalente aux dates du tableau.
     *
     * @throws \InvalidArgumentException Si la période n'a pas pû être récupérée depuis le tableau.
     */
    public static function fromArray(array $array): static
    {
        if (!array_key_exists('start', $array) || !array_key_exists('end', $array)) {
            $keys = array_keys($array);
            if (count($array) !== 2 || !is_numeric($keys[0]) || !is_numeric($keys[1])) {
                throw new \InvalidArgumentException('Missing date part in array.');
            }
            $array = array_combine(['start', 'end'], array_values($array));
        }

        // - Date de début / fin.
        $dateChecker = V::notEmpty()->dateTime();
        foreach (['start', 'end'] as $type) {
            $isValid = (
                $array[$type] instanceof DateTimeInterface ||
                ($type === 'end' && $array[$type] === null) ||
                $dateChecker->validate($array[$type])
            );
            if (!$isValid) {
                throw new \InvalidArgumentException(sprintf('Invalid `%s` date.', $type));
            }
        }

        // - Journées entières.
        if (array_key_exists('isFullDays', $array)) {
            Assert::true(
                V::boolType()->validate($array['isFullDays']),
                "Invalid `isFullDays` value.",
            );
            $isFullDays = $array['isFullDays'];
        } else {
            $isFullDays = (
                (is_string($array['start']) && date_parse($array['start'])['hour'] === false) &&
                (
                    $array['end'] === null ||
                    (is_string($array['end']) && date_parse($array['end'])['hour'] === false)
                )
            );
        }

        return new static($array['start'], $array['end'], $isFullDays);
    }
}
