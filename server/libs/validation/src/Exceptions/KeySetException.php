<?php
/*
 * Copyright (c) Alexandre Gomes Gaigalas <alganet@gmail.com>
 * SPDX-License-Identifier: MIT
 */
declare(strict_types=1);

namespace Respect\Validation\Exceptions;

use function count;

/**
 * @author Henrique Moody <henriquemoody@gmail.com>
 */
final class KeySetException extends GroupedValidationException implements NonOmissibleException
{
    public const STRUCTURE = 'structure';

    protected $defaultTemplates = [
        self::MODE_DEFAULT => [
            self::NONE => 'All of the required rules must pass for {{name}}',
            self::SOME => 'These rules must pass for {{name}}',
            self::STRUCTURE => 'Must have keys {{keys}}',
        ],
    ];

    protected function chooseTemplate(): string
    {
        if (count($this->getChildren()) === 0) {
            return self::STRUCTURE;
        }

        return parent::chooseTemplate();
    }
}
