<?php
declare(strict_types=1);

namespace Loxya\Support\Validation\Rules;

use Respect\Validation\Rules\AbstractRule;

final class BoolVal extends AbstractRule
{
    public function validate($input): bool
    {
        $validValues = [true, false, 'true', 'false', '0', '1', 0, 1];
        return in_array($input, $validValues, true);
    }
}
