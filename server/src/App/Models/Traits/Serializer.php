<?php
declare(strict_types=1);

namespace Loxya\Models\Traits;

use Brick\Math\BigDecimal as Decimal;
use Illuminate\Contracts\Support\Arrayable;
use Illuminate\Support\Collection;
use Loxya\Contracts\Serializable;
use Loxya\Support\Address;
use Loxya\Support\Country;

/**
 * @phpstan-require-extends \Loxya\Models\BaseModel
 */
trait Serializer
{
    public function serialize(): array
    {
        return $this->attributesForSerialization();
    }

    // ------------------------------------------------------
    // -
    // -    Méthodes internes
    // -
    // ------------------------------------------------------

    protected function attributesForSerialization(): array
    {
        $attributes = $this->getArrayableAttributes();
        $attributes = $this->addDateAttributesToArray($attributes);

        // - Mutateurs
        $mutatedAttributes = $this->getMutatedAttributes();
        foreach ($mutatedAttributes as $key) {
            if (!array_key_exists($key, $attributes)) {
                continue;
            }
            $attributes[$key] = $this->mutateAttributeForSerialization($key, $attributes[$key]);
        }

        // - Casts
        $attributes = $this->addCastAttributesToArray($attributes, $mutatedAttributes);

        // - Appends
        foreach ($this->getArrayableAppends() as $key) {
            $attributes[$key] = $this->mutateAttributeForSerialization($key, null);
        }

        return $attributes;
    }

    protected function mutateAttributeForSerialization(string $key, mixed $value): mixed
    {
        $value = $this->transformModelValue($key, $value);

        $serialize = function ($value) use (&$serialize) {
            if ($value instanceof Serializable) {
                return $value->serialize();
            }

            if ($value instanceof Decimal || $value instanceof Country) {
                return (string) $value;
            }

            if ($value instanceof Address) {
                return $value->format();
            }

            if ($value instanceof \DateTimeInterface) {
                return $this->serializeDate($value);
            }

            if ($value instanceof Collection) {
                return $value
                    ->map(static fn ($value) => $serialize($value))
                    ->all();
            }

            if ($value instanceof Arrayable) {
                return $value->toArray();
            }

            if (is_array($value)) {
                return array_map(
                    static fn ($subValue) => $serialize($subValue),
                    $value,
                );
            }

            return $value;
        };

        return $serialize($value);
    }
}
