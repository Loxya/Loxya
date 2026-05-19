<?php
declare(strict_types=1);

namespace Loxya\Support\Validation\Rules;

use Brick\Math\BigDecimal as DecimalNumber;
use Loxya\Support\Assert;
use Respect\Validation\Rules\AbstractRule;

final class Decimal extends AbstractRule
{
    private int|null $precision;
    private int $scale;

    public function __construct(int|null $precision, int $scale)
    {
        Assert::nullOrPositiveInteger($precision, 'Precision must be a positive integer.');
        Assert::true(
            $scale > 0 && ($precision === null || $scale <= $precision),
            'Scale must be a non-negative integer less than or equal to precision.',
        );

        $this->precision = $precision;
        $this->scale = $scale;
    }

    public function validate($input): bool
    {
        if (!is_numeric($input)) {
            return false;
        }

        $value = DecimalNumber::of($input);
        return (
            $value->getScale() <= $this->scale &&
            (
                $this->precision === null ||
                $value->getPrecision() <= $this->precision
            )
        );
    }
}
