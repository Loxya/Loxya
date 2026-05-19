<?php
declare(strict_types=1);

namespace Loxya\Support\Validation\Rules;

use Loxya\Support\Country;
use Respect\Validation\Exceptions\ComponentException;
use Respect\Validation\Rules\AbstractRule;
use Respect\Validation\Rules\CountryCode;

final class ActivityCode extends AbstractRule
{
    private string $countryCode;

    public function __construct(Country|string $country)
    {
        if (!($country instanceof Country) && !(new CountryCode())->validate($country)) {
            throw new ComponentException(sprintf('Invalid country code %s', $country));
        }
        $this->countryCode = $country instanceof Country ? $country->getCode() : $country;
    }

    public function validate($input): bool
    {
        if (!is_scalar($input)) {
            return false;
        }

        $country = new Country($this->countryCode);
        return $country->isValidActivityCode((string) $input);
    }
}
