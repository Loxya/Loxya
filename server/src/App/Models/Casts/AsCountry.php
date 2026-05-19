<?php
declare(strict_types=1);

namespace Loxya\Models\Casts;

use Illuminate\Contracts\Database\Eloquent\CastsAttributes;
use Illuminate\Contracts\Database\Eloquent\SerializesCastableAttributes;
use Loxya\Support\Country;

final class AsCountry implements CastsAttributes, SerializesCastableAttributes
{
    public function get($model, string $key, $value, array $attributes)
    {
        return $value !== null ? new Country($value) : null;
    }

    public function set($model, string $key, $value, array $attributes)
    {
        return $value instanceof Country ? $value->getCode() : $value;
    }

    public function serialize($model, string $key, $value, array $attributes)
    {
        return $value instanceof Country ? (string) $value : $value;
    }
}
