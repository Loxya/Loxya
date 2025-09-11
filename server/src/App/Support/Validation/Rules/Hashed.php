<?php
declare(strict_types=1);

namespace Loxya\Support\Validation\Rules;

use Loxya\Support\Hash;
use Respect\Validation\Rules\AbstractRule;

final class Hashed extends AbstractRule
{
    public function validate($input): bool
    {
        if (!is_string($input) || trim($input) === '') {
            return false;
        }
        return Hash::isHashed($input);
    }
}
