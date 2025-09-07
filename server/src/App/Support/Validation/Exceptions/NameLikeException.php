<?php
declare(strict_types=1);

namespace Loxya\Support\Validation\Exceptions;

use Respect\Validation\Exceptions\ValidationException as CoreValidationException;

final class NameLikeException extends CoreValidationException
{
    protected $defaultTemplates = [
        self::MODE_DEFAULT => [
            self::STANDARD => 'invalid-name-like',
        ],
    ];
}
