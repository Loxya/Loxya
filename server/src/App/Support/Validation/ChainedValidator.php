<?php
declare(strict_types=1);

namespace Loxya\Support\Validation;

use Loxya\Support\Country;
use Respect\Validation\Rules\Key;

interface ChainedValidator extends Core\ChainedValidator
{
    public function custom(callable $callback, ...$arguments): ChainedValidator;

    public function nameLike(): ChainedValidator;

    public function schemaStrict(Key ...$rule): ChainedValidator;

    public function enumValue(string $enumClass): ChainedValidator;

    public function email(bool $checkDns = false): ChainedValidator;

    public function hashed(): ChainedValidator;

    public function postalCode(Country|string $countryCode): ChainedValidator;

    public function registrationId(Country|string $countryCode, bool $preciseOnly = false): ChainedValidator;

    public function vatNumber(Country|string $countryCode): ChainedValidator;

    public function activityCode(Country|string $countryCode): ChainedValidator;

    public function invoiceRoutingIdentifier(Country|string $countryCode): ChainedValidator;

    public function phone(Country|string|null $countryCode = null, bool $strict = false): ChainedValidator;

    public function decimal(int|null $precision, int $scale): ChainedValidator;
}
