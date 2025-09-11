<?php
declare(strict_types=1);

namespace Loxya\Models\Casts;

use Illuminate\Contracts\Database\Eloquent\CastsAttributes;

final class AsSet implements CastsAttributes
{
    public function get($model, string $key, $value, array $attributes): ?array
    {
        return $value !== null ? explode(',', $value) : null;
    }

    public function set($model, string $key, $value, array $attributes): ?string
    {
        return is_array($value) ? implode(',', $value) : $value;
    }
}
