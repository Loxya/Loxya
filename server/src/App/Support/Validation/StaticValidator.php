<?php
declare(strict_types=1);

namespace Loxya\Support\Validation;

use Loxya\Support\Country;
use Respect\Validation\Rules\Key;

interface StaticValidator extends Core\StaticValidator
{
    public static function custom(callable $callback, ...$arguments): ChainedValidator;

    public static function nameLike(): ChainedValidator;

    public static function schemaStrict(Key ...$rule): ChainedValidator;

    public static function enumValue(string $enumClass): ChainedValidator;

    public static function email(bool $checkDns = false): ChainedValidator;

    public static function hashed(): ChainedValidator;

    public static function postalCode(Country|string $countryCode): ChainedValidator;

    public static function registrationId(Country|string $countryCode, bool $preciseOnly = false): ChainedValidator;

    public static function vatNumber(Country|string $countryCode): ChainedValidator;

    public static function activityCode(Country|string $countryCode): ChainedValidator;

    public static function invoiceRoutingIdentifier(Country|string $countryCode): ChainedValidator;

    public static function phone(Country|string|null $country = null, bool $strict = false): ChainedValidator;

    public static function decimal(int|null $precision, int $scale): ChainedValidator;
}
