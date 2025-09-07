<?php
declare(strict_types=1);

namespace Loxya\Support\Validation\Rules;

use Respect\Validation\NonNegatable;
use Respect\Validation\Rules\AbstractRule;

final class NameLike extends AbstractRule implements NonNegatable
{
    public function validate($input): bool
    {
        if (!is_string($input) || trim($input) === '') {
            return false;
        }

        // See https://regex101.com/r/8mwHdC/1
        // See https://www.regular-expressions.info/unicode.html#category
        return preg_match('/^[\p{L}\p{M}\p{N}\'’\-\._ ]+$/u', $input) === 1;
    }
}
