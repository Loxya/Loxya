<?php
declare(strict_types=1);

namespace Loxya\Contracts;

interface EnumFactory
{
    /**
     * @return class-string
     */
    public static function getEnumInterface(): string;

    public static function from(string $value): \BackedEnum;

    public static function tryFrom(string $value): ?\BackedEnum;
}
