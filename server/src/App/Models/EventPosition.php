<?php
declare(strict_types=1);

namespace Loxya\Models;

use Adbar\Dot as DotArray;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Loxya\Config\Enums\Feature;
use Loxya\Contracts\Serializable;
use Loxya\Models\Traits\Serializer;
use Loxya\Support\Validation\Validator as V;

/**
 * Un poste de technicien dans un événement.
 *
 * @property-read ?int $id
 * @property-read int $event_id
 * @property-read Event $event
 * @property-read int $role_id
 * @property-read Role $role
 * @property-read bool $is_mandatory
 * @property-read bool|null $is_assigned
 */
final class EventPosition extends BaseModel implements Serializable
{
    use Serializer;

    protected $table = 'event_positions';

    public $timestamps = false;

    protected $attributes = [
        'is_mandatory' => false,
    ];

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);

        $this->validation = fn () => [
            'event_id' => V::custom([$this, 'checkEventId']),
            'role_id' => V::custom([$this, 'checkRoleId']),
            'is_mandatory' => V::boolType(),
        ];
    }

    // ------------------------------------------------------
    // -
    // -    Validation
    // -
    // ------------------------------------------------------

    public function checkEventId($value)
    {
        V::nullable(V::intVal())->check($value);

        // - L'identifiant de l'événement n'est pas encore défini, on skip.
        if (!$this->exists && $value === null) {
            return true;
        }

        $event = Event::withTrashed()->find($value);
        if (!$event) {
            return false;
        }

        return !$this->exists || $this->isDirty('event_id')
            ? !$event->trashed()
            : true;
    }

    public function checkRoleId($value)
    {
        V::notEmpty()->intVal()->check($value);

        if (!Role::includes($value)) {
            return false;
        }

        // - L'identifiant de l'événement n'est pas encore défini...
        //   => On ne peut pas vérifier si le rôle est déjà utilisé dans celui-ci.
        if ($this->event_id === null) {
            return true;
        }

        $alreadyExists = static::query()
            ->where('event_id', $this->event_id)
            ->where('role_id', $value)
            ->when($this->exists, fn (Builder $subQuery) => (
                $subQuery->where('id', '!=', $this->id)
            ))
            ->exists();

        return !$alreadyExists ?: 'position-already-in-event';
    }

    // ------------------------------------------------------
    // -
    // -    Relations
    // -
    // ------------------------------------------------------

    public function event(): BelongsTo
    {
        return $this->belongsTo(Event::class);
    }

    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class);
    }

    // ------------------------------------------------------
    // -
    // -    Mutators
    // -
    // ------------------------------------------------------

    protected $appends = [
        'name',
        'is_assigned',
    ];

    protected $casts = [
        'event_id' => 'integer',
        'role_id' => 'integer',
        'is_mandatory' => 'boolean',
    ];

    public function getNameAttribute(): string
    {
        if (!$this->role) {
            throw new \LogicException(
                'The event position\'s related role is missing, ' .
                'this relation should always be defined.',
            );
        }
        return $this->role->name;
    }

    public function getIsAssignedAttribute(): bool|null
    {
        if (!$this->event) {
            throw new \LogicException(
                'The event position\'s related event is missing, ' .
                'this relation should always be defined.',
            );
        }

        if (!isFeatureEnabled(Feature::TECHNICIANS) || $this->event->is_archived) {
            return null;
        }

        return $this->event->technicians->some(fn (EventTechnician $eventTechnician) => (
            $eventTechnician->role_id === $this->role_id
        ));
    }

    // ------------------------------------------------------
    // -
    // -    Setters
    // -
    // ------------------------------------------------------

    protected $fillable = [
        'event_id',
        'role_id',
        'is_mandatory',
    ];

    // ------------------------------------------------------
    // -
    // -    Serialization
    // -
    // ------------------------------------------------------

    public function serialize(): array
    {
        $data = new DotArray($this->attributesForSerialization());

        return $data
            ->set('id', $this->role_id)
            ->delete(['event_id', 'role_id'])
            ->all();
    }

    public static function unserialize(array $data): array
    {
        $data = new DotArray($data);

        $data->delete(['role_id']);

        if ($data->has('id')) {
            $data->set('role_id', $data->get('id'));
            $data->delete('id');
        }

        return $data->all();
    }

    public static function serializeValidation(array $data): array
    {
        $data = new DotArray($data);

        if ($data->has('role_id')) {
            $data->set('id', $data->get('role_id'));
            $data->delete('role_id');
        }

        return $data->all();
    }
}
