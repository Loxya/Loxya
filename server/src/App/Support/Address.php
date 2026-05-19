<?php
declare(strict_types=1);

namespace Loxya\Support;

use CommerceGuys\Addressing\AddressFormat\AddressField as CoreAddressField;
use Loxya\Support\Addressing\AddressField;

/** Une adresse. */
final class Address implements \Stringable
{
    /** La première ligne d'adresse (e.g. rue et numéro). */
    private readonly string|null $addressLine1;

    /** La seconde ligne d'adresse (e.g. complément d'adresse). */
    private readonly string|null $addressLine2;

    /** La zone administrative (état, province, ...). */
    private readonly string|null $administrativeArea;

    /** La localité (ville, district, ...). */
    private readonly string|null $locality;

    /** Le code postal. */
    private readonly string|null $postalCode;

    /** Le pays. */
    private readonly Country $country;

    /**
     * Permet de créer une adresse.
     *
     * @param string|Country $country - Le pays (sous forme d'instance ou de code ISO).
     * @param string $addressLine1 - La première ligne d'adresse (e.g. rue et numéro).
     * @param string $addressLine2 - La seconde ligne d'adresse (e.g. complément d'adresse).
     * @param string $postalCode - Le code postal.
     * @param string $administrativeArea - La zone administrative (état, province, ...).
     * @param string $locality - La localité (ville, district, ...).
     */
    public function __construct(
        Country|string $country,
        string|null $addressLine1 = null,
        string|null $addressLine2 = null,
        string|null $postalCode = null,
        string|null $administrativeArea = null,
        string|null $locality = null,
    ) {
        $this->administrativeArea = $administrativeArea;
        $this->locality = $locality;
        $this->postalCode = $postalCode;
        $this->addressLine1 = $addressLine1;
        $this->addressLine2 = $addressLine2;
        $this->country = !($country instanceof Country)
            ? new Country($country)
            : $country;
    }

    public function getCountry(): Country
    {
        return $this->country;
    }

    public function withCountryCode(Country|string $country): static
    {
        return new static(
            $country,
            $this->addressLine1,
            $this->addressLine2,
            $this->postalCode,
            $this->administrativeArea,
            $this->locality,
        );
    }

    public function getAdministrativeArea(): string | null
    {
        return $this->administrativeArea;
    }

    public function withAdministrativeArea(string | null $administrativeArea): static
    {
        return new static(
            $this->country,
            $this->addressLine1,
            $this->addressLine2,
            $this->postalCode,
            $administrativeArea,
            $this->locality,
        );
    }

    public function getLocality(): string | null
    {
        return $this->locality;
    }

    public function withLocality(string|null $locality): static
    {
        return new static(
            $this->country,
            $this->addressLine1,
            $this->addressLine2,
            $this->postalCode,
            $this->administrativeArea,
            $locality,
        );
    }

    public function getPostalCode(): string | null
    {
        return $this->postalCode;
    }

    public function withPostalCode(string|null $postalCode): static
    {
        return new static(
            $this->country,
            $this->addressLine1,
            $this->addressLine2,
            $postalCode,
            $this->administrativeArea,
            $this->locality,
        );
    }

    public function getAddressLine1(): string | null
    {
        return $this->addressLine1;
    }

    public function withAddressLine1(string|null $addressLine1): static
    {
        return new static(
            $this->country,
            $addressLine1,
            $this->addressLine2,
            $this->postalCode,
            $this->administrativeArea,
            $this->locality,
        );
    }

    public function getAddressLine2(): string | null
    {
        return $this->addressLine2;
    }

    public function withAddressLine2(string|null $addressLine2): static
    {
        return new static(
            $this->country,
            $this->addressLine1,
            $addressLine2,
            $this->postalCode,
            $this->administrativeArea,
            $this->locality,
        );
    }

    /**
     * Permet de récupérer la valeur d'un des champs d'adresse.
     *
     * @param AddressField $field Le champ à récupérer.
     *
     * @return string|null La valeur du champ, ou `null` si vide.
     */
    public function getField(AddressField $field): string|null
    {
        return match ($field) {
            AddressField::ADDRESS_LINE1 => $this->addressLine1,
            AddressField::ADDRESS_LINE2 => $this->addressLine2,
            AddressField::POSTAL_CODE => $this->postalCode,
            AddressField::ADMINISTRATIVE_AREA => $this->administrativeArea,
            AddressField::LOCALITY => $this->locality,
        };
    }

    /**
     * Formate l'adresse.
     *
     * @param bool $withCountry Le pays doit-il être affiché ?
     *
     * @returns L'adresse sous forme de chaîne lisible par un humain.
     *          (ou `null` si elle ne contient aucune données)
     */
    public function format(bool $withCountry = false): string|null
    {
        $replacements = Arr::mapWithKeys(
            CoreAddressField::getAll(),
            function (string $field) {
                $value = match ($field) {
                    CoreAddressField::ADDRESS_LINE1 => $this->addressLine1,
                    CoreAddressField::ADDRESS_LINE2 => $this->addressLine2,
                    CoreAddressField::POSTAL_CODE => $this->postalCode,
                    CoreAddressField::ADMINISTRATIVE_AREA => $this->administrativeArea,
                    CoreAddressField::LOCALITY => $this->locality,
                    default => null,
                };
                return [sprintf('%%%s', $field) => trim($value ?? '')];
            },
        );
        $output = strtr($this->country->getAddressTemplate(), $replacements);

        // - On supprime la ponctuation orpheline, les espaces
        //   indésirables et les lignes vides.
        $lines = array_filter(array_map(
            static fn (string $line) => (
                Str::of($line)
                    ->trim(' -,')
                    ->replaceMatches('/\s{2,}/', ' ')
                    ->replaceMatches('/\s+,/', ',')
                    ->replaceMatches('/,{2,}/', ',')
                    ->replaceMatches('/-{2,}/', '-')
                    ->toString()
            ),
            explode("\n", $output),
        ));

        // - Ajout du pays à l'adresse.
        if ($withCountry) {
            $lines[] = $this->country->getName();
        }

        return !empty($lines) ? implode("\n", $lines) : null;
    }

    public function __toString(): string
    {
        return $this->format() ?? '';
    }
}
