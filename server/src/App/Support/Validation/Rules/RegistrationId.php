<?php
declare(strict_types=1);

namespace Loxya\Support\Validation\Rules;

use Loxya\Support\Country;
use Respect\Validation\Exceptions\ComponentException;
use Respect\Validation\Rules\AbstractRule;
use Respect\Validation\Rules\CountryCode;

final class RegistrationId extends AbstractRule
{
    private string $countryCode;
    private bool $preciseOnly;

    public function __construct(Country|string $country, bool $preciseOnly = false)
    {
        if (!($country instanceof Country) && !(new CountryCode())->validate($country)) {
            throw new ComponentException(sprintf('Invalid country code %s', $country));
        }

        $this->countryCode = $country instanceof Country ? $country->getCode() : $country;
        $this->preciseOnly = $preciseOnly;
    }

    public function validate($input): bool
    {
        if (!is_scalar($input)) {
            return false;
        }

        $country = new Country($this->countryCode);
        return $country->isValidCompanyIdentifier((string) $input, $this->preciseOnly);
    }
}
