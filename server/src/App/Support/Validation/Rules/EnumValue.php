<?php
declare(strict_types=1);

namespace Loxya\Support\Validation\Rules;

use Loxya\Support\Assert;
use Respect\Validation\Rules\AbstractWrapper;
use Respect\Validation\Rules\In;

final class EnumValue extends AbstractWrapper
{
    public function __construct(string $enumClass)
    {
        Assert::enumExists($enumClass, 'Unknown enum class `%s`.');
        Assert::isAOf($enumClass, \BackedEnum::class, 'Enum class should be a backed enum.');

        parent::__construct(new In(array_map(
            static fn (\BackedEnum $choice) => $choice->value,
            $enumClass::cases(),
        )));
    }
}
