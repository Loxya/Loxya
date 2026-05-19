<?php
declare(strict_types=1);

namespace Loxya\Support\Data\LegalType;

use Loxya\Contracts\EnumFactory;

final class LegalTypeFactory implements EnumFactory
{
    public static function getEnumInterface(): string {
        return LegalTypeInterface::class;
    }

    public static function tryFrom(string $value): ?LegalTypeInterface
    {
        $enumClass = static::getEnumClass($value);
        if ($enumClass === null) {
            return null;
        }
        return $enumClass::tryFrom($value);
    }

    public static function from(string $value): LegalTypeInterface
    {
        $enumClass = static::getEnumClass($value);
        if ($enumClass === null) {
            throw new \ValueError(sprintf("Unknown legal type value `%s`.", $value));
        }
        return $enumClass::from($value);
    }

    /**
     * @return class-string<LegalTypeInterface>
     */
    private static function getEnumClass(string $value): string|null
    {
        [$country] = explode('.', $value, 2);

        $baseNamespace = 'Loxya\\Support\\Data\\LegalType\\';
        $baseClassName = sprintf('LegalType%s', ucfirst(strtolower($country)));
        $className = $baseNamespace . $baseClassName;

        return class_exists($className) ? $className : null;
    }
}
