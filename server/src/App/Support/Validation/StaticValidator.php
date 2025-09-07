<?php
declare(strict_types=1);

namespace Loxya\Support\Validation;

use Respect\Validation\Rules\Key;

interface StaticValidator extends Core\StaticValidator
{
    public static function custom(callable $callback, ...$arguments): ChainedValidator;

    public static function nameLike(): ChainedValidator;

    public static function schemaStrict(Key ...$rule): ChainedValidator;

    public static function enumValue(string $enumClass): ChainedValidator;

    public static function email(bool $checkDns = false): ChainedValidator;

    public static function hashed(): ChainedValidator;
}
