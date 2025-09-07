<?php
declare(strict_types=1);

namespace Loxya\Support\Validation;

use Respect\Validation\Rules\Key;

interface ChainedValidator extends Core\ChainedValidator
{
    public function custom(callable $callback, ...$arguments): ChainedValidator;

    public function nameLike(): ChainedValidator;

    public function schemaStrict(Key ...$rule): ChainedValidator;

    public function enumValue(string $enumClass): ChainedValidator;

    public function email(bool $checkDns = false): ChainedValidator;

    public function hashed(): ChainedValidator;
}
