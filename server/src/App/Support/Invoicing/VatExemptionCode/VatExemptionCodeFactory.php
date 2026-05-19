<?php
declare(strict_types=1);

namespace Loxya\Support\Invoicing\VatExemptionCode;

use Loxya\Contracts\EnumFactory;

final class VatExemptionCodeFactory implements EnumFactory
{
    public static function getEnumInterface(): string {
        return VatExemptionCodeInterface::class;
    }

    public static function tryFrom(string $value): ?VatExemptionCodeInterface
    {
        $enumClasses = static::getEnumClasses();
        foreach ($enumClasses as $enumClass) {
            $case = $enumClass::tryFrom($value);
            if ($case !== null) {
                return $case;
            }
        }
        return null;
    }

    public static function from(string $value): VatExemptionCodeInterface
    {
        $case = static::tryFrom($value);
        if ($case === null) {
            throw new \ValueError(sprintf("Unknown VAT Exemption value `%s`.", $value));
        }
        return $case;
    }

    /**
     * @return list<class-string<VatExemptionCodeInterface>>
     */
    private static function getEnumClasses(): array
    {
        return [
            VatExemptionCodeEu::class,
            VatExemptionCodeFr::class,
            VatExemptionCodeBe::class,
        ];
    }
}
