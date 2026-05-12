<?php
/*
 * Copyright (c) Alexandre Gomes Gaigalas <alganet@gmail.com>
 * SPDX-License-Identifier: MIT
 */
declare(strict_types=1);

namespace Respect\Validation\Exceptions;

/**
 * @author Alexandre Gomes Gaigalas <alganet@gmail.com>
 * @author Henrique Moody <henriquemoody@gmail.com>
 * @author William Espindola <oi@williamespindola.com.br>
 */
final class EachException extends NestedValidationException
{
    protected $defaultTemplates = [
        self::MODE_DEFAULT => [
            self::STANDARD => 'Each item in {{name}} must be valid',
        ],
        self::MODE_NEGATIVE => [
            self::STANDARD => 'Each item in {{name}} must not validate',
        ],
    ];

    public function getMessages(): array
    {
        return array_map(
            static fn ($exception) => $exception->getMessage(),
            $this->getChildren(),
        );
    }
}
