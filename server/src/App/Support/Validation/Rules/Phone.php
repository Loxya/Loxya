<?php
declare(strict_types=1);

namespace Loxya\Support\Validation\Rules;

use Loxya\Support\Country;
use Respect\Validation\Exceptions\ComponentException;
use Respect\Validation\Rules\AbstractRule;
use Respect\Validation\Rules\CountryCode;

final class Phone extends AbstractRule
{
    private bool $strict;
    private string|null $countryCode;

    public function __construct(Country|string|null $country = null, bool $strict = false)
    {
        if (
            $country !== null &&
            !($country instanceof Country) &&
            !(new CountryCode())->validate($country)
        ) {
            throw new ComponentException(sprintf('Invalid country code %s', $country));
        }

        $this->strict = $strict;
        $this->countryCode = $country instanceof Country ? $country->getCode() : $country;
    }

    public function validate($input): bool
    {
        if (!is_scalar($input)) {
            return false;
        }

        if ($this->countryCode === null) {
            $pattern = vsprintf(
                '/^\+?(%1$s)? ?(?(?=\()(\(%2$s\) ?%3$s)|([. -]?(%2$s[. -]*)?%3$s))$/',
                ['\d{0,3}', '\d{1,3}', '((\d{3,5})[. -]?(\d{2}[. -]?\d{2})|(\d{2}[. -]?){4})'],
            );
            return preg_match($pattern, (string) $input) > 0;
        }

        $country = new Country($this->countryCode);
        return $country->isValidPhoneNumber((string) $input, $this->strict);
    }
}
