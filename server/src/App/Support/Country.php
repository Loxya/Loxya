<?php
declare(strict_types=1);

namespace Loxya\Support;

use CommerceGuys\Addressing\AddressFormat\AddressField as CoreAddressField;
use CommerceGuys\Addressing\AddressFormat\AddressFormat;
use CommerceGuys\Addressing\AddressFormat\AddressFormatHelper;
use CommerceGuys\Addressing\AddressFormat\AddressFormatRepository;
use CommerceGuys\Addressing\AddressFormat\FieldOverride;
use CommerceGuys\Addressing\AddressFormat\FieldOverrides;
use Illuminate\Support\Collection;
use libphonenumber\NumberParseException;
use libphonenumber\PhoneNumberFormat;
use libphonenumber\PhoneNumberUtil;
use Loxya\Config\Config;
use Loxya\Models\Enums\LegalEntityType;
use Loxya\Models\Invoice;
use Loxya\Services\I18n;
use Loxya\Support\Addressing\AddressField;
use Loxya\Support\Addressing\AdministrativeAreaType;
use Loxya\Support\Addressing\LocalityType;
use Loxya\Support\Addressing\PostalCodeType;
use Loxya\Support\Data\CountryMetadata\CountryMetadataInterface;
use Loxya\Support\Data\ElectronicInvoiceFormat;
use Loxya\Support\Data\IdentifierScheme;
use Loxya\Support\Data\InvoiceRoutingIdentifierScheme;
use Loxya\Support\Data\LegalType\LegalTypeInterface;
use Loxya\Support\Invoicing\BusinessProcessType\BusinessProcessTypeInterface;
use Loxya\Support\Invoicing\BuyerInterface;
use Loxya\Support\Invoicing\LegalMention;
use Loxya\Support\Invoicing\StrictTaxRegime;
use Loxya\Support\Invoicing\TaxRegime;
use Loxya\Support\Invoicing\UblSpecification;
use Loxya\Support\Invoicing\VatExemptionCode\VatExemptionCodeEu;
use Loxya\Support\Invoicing\VatExemptionCode\VatExemptionCodeInterface;
use Loxya\Support\Validation\Validator as V;
use Punic\Currency;
use Punic\Territory;

/** Données liées à un pays. */
final class Country implements \JsonSerializable
{
    private string $code;

    /** @var class-string<CountryMetadataInterface> */
    private string|null $metadataClass;

    /**
     * Initialise une instance pour un pays donné.
     *
     * @param string $code Code ISO 3166-1 alpha-2 du pays.
     *
     * @throws \InvalidArgumentException Si le code est invalide.
     */
    public function __construct(string $code)
    {
        Assert::true(V::countryCode()->validate($code), 'Invalid country code.');

        $this->code = strtoupper($code);
    }

    /**
     * Retourne le code ISO du pays.
     *
     * @return string Le code ISO 3166-1 alpha-2.
     */
    public function getCode(): string
    {
        return $this->code;
    }

    /**
     * Retourne le nom du pays, localisé.
     *
     * @param ?string $locale La locale à utiliser pour le nom du pays.
     *                        Si non spécifiée, la locale courante sera utilisée.
     *
     * @return string Le nom du pays, localisé.
     */
    public function getName(?string $locale = null): string
    {
        $locale ??= container('i18n')->getLocale();
        $normalizedLocale = \Locale::canonicalize($locale) ?: $locale;

        $name = Territory::getName($this->code, $normalizedLocale);
        if ($name === $this->code) {
            $name = null;
        }

        return $name ?? Territory::getName($this->code, 'en');
    }

    /**
     * Retourne le modèle d'adresse pour le pays.
     *
     * @return string Une chaîne contenant le modèle d'adresse pour le pays.
     */
    public function getAddressTemplate(): string
    {
        return $this->getRawAddressFormat()->getFormat();
    }

    /**
     * Retourne les champs d'adresse pour le pays.
     *
     * @param bool $grouped Indique si les champs doivent être groupés par lignes.
     *
     * @return array Un tableau avec le détails de chaque champ d'adresse pour le pays.
     */
    public function getAddressFields(bool $grouped = false): array
    {
        static $addressFieldsCaches = [];

        if (!array_key_exists($this->code, $addressFieldsCaches)) {
            $addressFormat = $this->getRawAddressFormat();
            $rawAddressFormat = $addressFormat->getFormat();

            $fieldOverrides = new FieldOverrides([
                CoreAddressField::GIVEN_NAME => FieldOverride::HIDDEN,
                CoreAddressField::ADDITIONAL_NAME => FieldOverride::HIDDEN,
                CoreAddressField::FAMILY_NAME => FieldOverride::HIDDEN,
                CoreAddressField::SORTING_CODE => FieldOverride::HIDDEN,
                CoreAddressField::DEPENDENT_LOCALITY => FieldOverride::HIDDEN,
                CoreAddressField::ORGANIZATION => FieldOverride::HIDDEN,
                CoreAddressField::ADDRESS_LINE3 => FieldOverride::HIDDEN,
            ]);

            $requiredFields = AddressFormatHelper::getRequiredFields($addressFormat, $fieldOverrides);
            $usedFields = Arr::collapse(AddressFormatHelper::getGroupedFields($rawAddressFormat, $fieldOverrides));
            $typedFields = [
                AddressField::POSTAL_CODE->value => 'getPostalCodeType',
                AddressField::LOCALITY->value => 'getLocalityType',
                AddressField::ADMINISTRATIVE_AREA->value => 'getAdministrativeAreaType',
            ];

            $addressFieldsCaches[$this->code] = array_map(
                function (string $field) use ($requiredFields, $typedFields) {
                    $normalizedField = match ($field) {
                        CoreAddressField::ADDRESS_LINE1 => AddressField::ADDRESS_LINE1,
                        CoreAddressField::ADDRESS_LINE2 => AddressField::ADDRESS_LINE2,
                        CoreAddressField::POSTAL_CODE => AddressField::POSTAL_CODE,
                        CoreAddressField::LOCALITY => AddressField::LOCALITY,
                        CoreAddressField::ADMINISTRATIVE_AREA => AddressField::ADMINISTRATIVE_AREA,
                        default => (
                            throw new \LogicException(sprintf("Unhandled address field: `%s`", $field))
                        ),
                    };

                    $data = [
                        'field' => $normalizedField,
                        'required' => in_array($field, $requiredFields, true),
                    ];
                    if (array_key_exists($normalizedField->value, $typedFields)) {
                        $data['type'] = call_user_func([$this, $typedFields[$normalizedField->value]]);
                    }
                    return $data;
                },
                $usedFields,
            );
        }

        $definitions = $addressFieldsCaches[$this->code];
        if (!$grouped) {
            return $definitions;
        }

        // - Pour le mode groupé, on ne se base pas sur les lignes de l'adresse
        //   mais sur trois groupes: Ligne d'adresse 1, Ligne d'adresse 2 et
        //   le reste des champs liés à la localité sur une ligne.
        $groups = [
            AddressField::ADDRESS_LINE1->value => [],
            AddressField::ADDRESS_LINE2->value => [],
            AddressField::LOCALITY->value => [],
        ];
        $groupOrder = [];

        foreach ($definitions as $definition) {
            $group = match ($definition['field']) {
                AddressField::ADDRESS_LINE1->value => (
                    AddressField::ADDRESS_LINE1->value
                ),
                AddressField::ADDRESS_LINE2->value => (
                    AddressField::ADDRESS_LINE2->value
                ),
                default => (
                    AddressField::LOCALITY->value
                )
            };
            if (!in_array($group, $groupOrder, true)) {
                $groupOrder[] = $group;
            }
            $groups[$group][] = $definition;
        }

        return array_map(
            static fn ($group) => $groups[$group],
            $groupOrder,
        );
    }

    /**
     * Retourne la liste des champs d'adresse utilisé par le pays.
     *
     * @return AddressField[] Un tableau avec les champs d'adresse pour le pays.
     */
    public function getUsedAddressField(): array {
        return array_map(
            static fn ($definition) => $definition['field'],
            $this->getAddressFields(grouped: false),
        );
    }

    /**
     * Est-ce que le champ d'adresse est requis pour le pays ?
     *
     * @param AddressField $field Le champ concerné.
     *
     * @return bool `true` si le champ est obligatoire, `false` sinon.
     */
    public function isAddressFieldMandatory(AddressField $field): bool
    {
        $fields = $this->getAddressFields();
        return Arr::some($fields, static fn ($_field) => (
            $_field['field'] === $field && $_field['required']
        ));
    }

    /**
     * Retourne le type de zone administrative (e.g. État, Province, etc.).
     *
     * @return AdministrativeAreaType Le type de zone administrative.
     */
    public function getAdministrativeAreaType(): AdministrativeAreaType
    {
        return AdministrativeAreaType::from($this->getRawAddressFormat()->getAdministrativeAreaType());
    }

    /**
     * Retourne le type de localité (e.g. Ville, District, etc.).
     *
     * @return LocalityType Le type de localité.
     */
    public function getLocalityType(): LocalityType
    {
        return LocalityType::from($this->getRawAddressFormat()->getLocalityType());
    }

    /**
     * Retourne le type de code postal utilisé dans le pays (e.g. ZIP Code, Code postal, etc.).
     *
     * @return PostalCodeType Le type de code postal.
     */
    public function getPostalCodeType(): PostalCodeType
    {
        return PostalCodeType::from($this->getRawAddressFormat()->getPostalCodeType());
    }

    /**
     * Permet de vérifier qu'une valeur est un code postal valide pour le pays.
     *
     * @param string $value La valeur à vérifier.
     *
     * @return bool `true` si la valeur est potentiellement valide, `false` sinon.
     */
    public function isValidPostalCode(string $value): bool
    {
        $hasPostalCodeField = Arr::some(
            $this->getAddressFields(),
            static fn ($_field) => (
                $_field['field'] === AddressField::POSTAL_CODE
            ),
        );
        if (!$hasPostalCodeField) {
            return false;
        }

        // - Si on a pas de données, on part du principe
        //   que c'est valide si non vide...
        $basePattern = $this->getRawAddressFormat()->getPostalCodePattern();
        if ($basePattern === null) {
            return V::notEmpty()->validate($value);
        }

        return preg_match(sprintf('/^%s$/i', $basePattern), $value) > 0;
    }

    /**
     * Permet de vérifier qu'une valeur est un code d'activité valide pour le pays.
     *
     * @param string $value La valeur à vérifier.
     *
     * @return bool `true` si la valeur est potentiellement valide, `false` sinon.
     */
    public function isValidActivityCode(string $value): bool
    {
        $metadataClass = $this->getMetadataClass();

        // - Si on a pas de données, on part du principe
        //   que c'est valide si non vide...
        if ($metadataClass === null) {
            return V::notEmpty()->validate($value);
        }

        return preg_match($metadataClass::getActivityCodePattern(), $value) > 0;
    }

    /**
     * Permet de normaliser un code d'activité du pays.
     *
     * @return string Le code d'activité, normalisé.
     */
    public function normalizeActivityCode(string $value): string
    {
        $metadataClass = $this->getMetadataClass();
        return $metadataClass !== null
            ? $metadataClass::normalizeActivityCode($value)
            : $value;
    }

    /**
     * Déduit l'identifiant principal de l'entreprise depuis un identifiant
     * d'établissement (ou depuis l'identifiant principal, auquel cas, il sera
     * retourné à l'identique).
     *
     * @param string $companyIdentifier Un identifiant de société, principal ou non.
     *
     * @return string L'identifiant principal de l'entreprise.
     */
    public function inferMainCompanyIdentifier(string $companyIdentifier): string
    {
        $metadata = $this->getCompanyIdentifierMetadata($companyIdentifier);
        return $metadata === null ? $companyIdentifier : $metadata['main'];
    }

    /**
     * Tente de déduire (si possible) le numéro de T.V.A depuis un identifiant de société.
     *
     * @param string $companyIdentifier Un identifiant de société, principal ou non.
     *
     * @return string|null Le numéro de T.V.A. s'il a pû être déduit, `null` sinon.
     */
    public function inferVatNumberFromCompanyIdentifier(string $companyIdentifier): string|null
    {
        $metadataClass = $this->getMetadataClass();
        return $metadataClass !== null
            ? $metadataClass::inferVatNumberFromCompanyIdentifier($companyIdentifier)
            : null;
    }

    /**
     * Permet de vérifier qu'une valeur est un numéro de T.V.A. valide pour le pays.
     *
     * @param string $value La valeur à vérifier.
     *
     * @return bool `true` si la valeur est potentiellement valide, `false` sinon.
     */
    public function isValidVatNumber(string $value): bool
    {
        $metadataClass = $this->getMetadataClass();
        if ($metadataClass !== null) {
            return preg_match($metadataClass::getVatNumberPattern(), $value) > 0;
        }

        // - Pour les pays membres de l'UE sans classe de métadonnées spécifique,
        //   on valide un format générique.
        if ($this->isEuVatMember()) {
            $prefix = match ($this->code) {
                'GR' => 'EL',
                'MC' => 'FR',
                default => $this->code,
            };
            return preg_match(sprintf('/^%s[A-Z0-9.\s-]{2,13}$/i', preg_quote($prefix, '/')), $value) > 0;
        }

        // - Sinon, si on a pas de données, on part du principe
        //   que c'est valide si non vide...
        return V::notEmpty()->validate($value);
    }

    /**
     * Permet de normaliser un numéro de T.V.A. du pays courant.
     *
     * @return string Le numéro de T.V.A., normalisé.
     */
    public function normalizeVatNumber(string $value): string
    {
        $metadataClass = $this->getMetadataClass();
        if ($metadataClass !== null) {
            return $metadataClass::normalizeVatNumber($value);
        }

        // - Pour les pays membres de l'UE sans classe de métadonnées spécifique,
        //   on garde le formatage mais on met en majuscule le préfixe du pays.
        if ($this->isEuVatMember()) {
            $prefix = match ($this->code) {
                'GR' => 'EL',
                'MC' => 'FR',
                default => $this->code,
            };
            $pattern = sprintf('/^%s(?<digits>[A-Z0-9.\s-]{2,13})$/i', preg_quote($prefix, '/'));
            if (!preg_match($pattern, $value, $matches)) {
                throw new \InvalidArgumentException('Invalid value.');
            }
            return strtoupper($this->code) . $matches['digits'];
        }

        $metadataClass = $this->getMetadataClass();
        return $metadataClass !== null
            ? $metadataClass::normalizeVatNumber($value)
            : $value;
    }

    /**
     * Permet de vérifier qu'une valeur est un identifiant de
     * routage e-facturation correct pour le pays.
     *
     * @param string $value La valeur à vérifier.
     *
     * @return bool `true` si la valeur est potentiellement valide, `false` sinon.
     */
    public function isValidInvoiceRoutingIdentifier(string $value): bool
    {
        $metadataClass = $this->getMetadataClass();
        $pattern = $metadataClass !== null
            ? $metadataClass::getInvoiceRoutingIdentifierPattern()
            : null;

        if ($pattern === null) {
            return V::notEmpty()->validate($value);
        }

        return preg_match($pattern, $value) > 0;
    }

    /**
     * Permet de normaliser un identifiant de routage e-facturation du pays courant.
     *
     * @param string $value L'identifiant à normaliser.
     *
     * @return string L'identifiant de routage e-facturation, normalisé.
     */
    public function normalizeInvoiceRoutingIdentifier(string $value): string
    {
        $metadataClass = $this->getMetadataClass();
        return $metadataClass !== null
            ? $metadataClass::normalizeInvoiceRoutingIdentifier($value)
            : $value;
    }

    /**
     * Indique si l'identifiant de routage e-facturation par défaut peut être
     * déduit automatiquement depuis un identifiant de société.
     *
     * @return bool `true` si l'identifiant peut être déduit, `false` sinon.
     */
    public function canInferDefaultInvoiceRoutingIdentifier(): bool
    {
        $metadataClass = $this->getMetadataClass();
        return $metadataClass !== null
            ? $metadataClass::canInferDefaultInvoiceRoutingIdentifier()
            : false;
    }

    /**
     * Tente de déduire l'identifiant de routage e-facturation
     * par défaut depuis un identifiant de société.
     *
     * @param string $companyIdentifier Un identifiant de société, principal ou non.
     *
     * @return string|null L'identifiant de routage déduit, ou `null` si la déduction est impossible.
     */
    public function inferDefaultInvoiceRoutingIdentifier(string $companyIdentifier): string|null
    {
        $metadataClass = $this->getMetadataClass();
        return $metadataClass !== null
            ? $metadataClass::inferDefaultInvoiceRoutingIdentifier($companyIdentifier)
            : null;
    }

    /**
     * Retourne les méta-données d'un identifiant de routage e-facturation.
     *
     * @param string $value L'identifiant de routage dont on veut récupérer les méta-données.
     *
     * @return array{ scheme: InvoiceRoutingIdentifierScheme, value: string }|null Les méta-données, ou `null` si l'identifiant est invalide.
     */
    public function getInvoiceRoutingIdentifierMetadata(string $value): array|null
    {
        if (!$this->isValidInvoiceRoutingIdentifier($value)) {
            throw new \InvalidArgumentException("Invalid routing identifier.");
        }

        [$schemeCode, $rawValue] = explode(':', $this->normalizeInvoiceRoutingIdentifier($value), 2);
        return [
            'scheme' => InvoiceRoutingIdentifierScheme::from($schemeCode),
            'value' => $rawValue,
        ];
    }

    /**
     * Permet de vérifier qu'une valeur est un numéro de
     * téléphone correct pour le pays.
     *
     * @param string $value  La valeur à vérifier.
     * @param bool   $strict Si `true`, le numéro devra impérativement être un numéro du
     *                       présent pays. Sinon, le format international sera accepté.
     *
     * @return bool `true` si la valeur est potentiellement valide, `false` sinon.
     */
    public function isValidPhoneNumber(string $value, bool $strict = false): bool
    {
        $phoneUtil = PhoneNumberUtil::getInstance();

        try {
            $phone = $phoneUtil->parse($value, $this->code);
        } catch (NumberParseException) {
            return false;
        }

        return $strict
            ? $phoneUtil->isValidNumberForRegion($phone, $this->code)
            : $phoneUtil->isValidNumber($phone);
    }

    /**
     * Normalise un numéro de téléphone au format E.164
     * (e.g. +33123456789 pour la France) pour le pays courant.
     *
     * @param string $value Le numéro à normaliser.
     *
     * @return string Le numéro au format E.164.
     *
     * @throws \InvalidArgumentException Si le numéro est invalide.
     */
    public function normalizePhoneNumber(string $value): string
    {
        $phoneUtil = PhoneNumberUtil::getInstance();

        try {
            $phone = $phoneUtil->parse($value, $this->code);
        } catch (NumberParseException) {
            throw new \InvalidArgumentException('Invalid phone number');
        }

        return $phoneUtil->format($phone, PhoneNumberFormat::E164);
    }

    /**
     * Retourne la première langue officiellement supportée par l'application pour ce pays.
     *
     * @return string Le code de langue ISO 639-1 (e.g. `fr`, `en`) ou `null` si aucun.
     */
    public function getFirstSupportedLanguage(): string|null
    {
        $languages = $this->getLanguages();
        foreach ($languages as $language) {
            if (array_key_exists($language, I18n::AVAILABLE_LANGUAGES)) {
                return $language;
            }
        }
        return null;
    }

    /**
     * Retourne la première locale officiellement supportée par l'application pour ce pays.
     *
     * @return string La locale BCP 47/ICU (e.g. `fr_FR`) ou `null` si aucun.
     */
    public function getFirstSupportedLocale(): string|null
    {
        $locales = $this->getLocales();
        foreach ($locales as $locale) {
            $language = \Locale::getPrimaryLanguage($locale);
            if (array_key_exists($language, I18n::AVAILABLE_LANGUAGES)) {
                return $locale;
            }
        }
        return null;
    }

    /**
     * Retourne le fuseau horaire par défaut du pays.
     *
     * @return string|null Identifiant de fuseau horaire IANA
     *                     (e.g. `Europe/Paris`) ou `null` si inconnu.
     */
    public function getDefaultTimezone(): string|null
    {
        return Arr::first($this->getTimezones());
    }

    /**
     * Retourne les langues principales parlées dans le pays.
     *
     * @return array La liste des codes de langues ISO 639-1.
     */
    public function getLanguages(): array
    {
        return array_map(
            static fn (string $locale) => \Locale::getPrimaryLanguage($locale),
            $this->getLocales(),
        );
    }

    /**
     * Retourne les locales probables pour le pays, classées par pertinence.
     *
     * @return array La liste de locales BCP 47/ICU (e.g. `fr_FR`).
     */
    public function getLocales(): array
    {
        return (new Collection(Territory::getLanguages($this->code, 'o') ?? []))
            ->sortByDesc('population')
            ->map(function ($rawLanguage) {
                $parts = preg_split('/[-_]/', $rawLanguage['id']);
                $language = strtolower($parts[0] ?? 'en');

                $script = null;
                if (isset($parts[1]) && strlen($parts[1]) === 4) {
                    $script = $parts[1]; // e.g. 'Hant', 'Cyrl', 'Latn', ...
                }
                if ($script === null) {
                    if ($language === 'zh') {
                        $script = in_array($this->code, ['CN', 'SG'], true) ? 'Hans' : 'Hant';
                    }
                    if ($language === 'sr') {
                        $script = 'Cyrl';
                    }
                }

                $guessedLocale = \Locale::composeLocale(array_filter([
                    'language' => $language,
                    'script' => $script,
                    'region' => $this->code,
                ]));
                return $guessedLocale ?: $language;
            })
            ->unique()
            ->all();
    }

    /**
     * Retourne les fuseaux horaires du pays.
     *
     * @return array La liste des identifiants IANA (e.g. `Europe/Paris`) supportés par le pays.
     */
    public function getTimezones(): array
    {
        return \DateTimeZone::listIdentifiers(\DateTimeZone::PER_COUNTRY, $this->code);
    }

    /**
     * Retourne la devise principale du pays.
     *
     * @return string|null Le code de devise ISO 4217 (e.g. `EUR`) ou `null` si indisponible.
     */
    public function getMainCurrency(): string|null
    {
        return Arr::first($this->getCurrencies());
    }

    /**
     * Retourne les devises supportées par le pays.
     * Le premier élément est la devise principale.
     *
     * @return list<string> La liste des codes de devise ISO 4217 (e.g. `EUR`).
     */
    public function getCurrencies(): array
    {
        $metadataClass = $this->getMetadataClass();
        if ($metadataClass !== null) {
            return $metadataClass::getCurrencies();
        }

        $currency = Currency::getCurrencyForTerritory($this->code);
        return $currency === '' ? [] : [$currency];
    }

    /**
     * Determine si le pays est un État membre de l'Union européenne au sens T.V.A.
     *
     * @return bool `true` s'il fait partie de l'UE au sens T.V.A., `false` sinon.
     */
    public function isEuVatMember(): bool
    {
        $euCountries = [
            'AT', // Autriche
            'BE', // Belgique
            'BG', // Bulgarie
            'CY', // Chypre
            'CZ', // République tchèque
            'DE', // Allemagne
            'DK', // Danemark
            'EE', // Estonie
            'ES', // Espagne
            'FI', // Finlande
            'FR', // France
            'GR', // Grèce
            'HR', // Croatie
            'HU', // Hongrie
            'IE', // Irlande
            'IT', // Italie
            'LT', // Lituanie
            'LU', // Luxembourg
            'LV', // Lettonie
            'MT', // Malte
            'NL', // Pays-Bas
            'PL', // Pologne
            'PT', // Portugal
            'RO', // Roumanie
            'SE', // Suède
            'SI', // Slovénie
            'SK', // Slovaquie

            // - Cas spéciaux
            'MC', // Monaco
        ];
        return in_array($this->getCode(), $euCountries, true);
    }

    /**
     * Permet de vérifier qu'une valeur est un identifiant
     * de société correct pour le pays.
     *
     * @param string $value       La valeur à vérifier.
     * @param bool   $preciseOnly Si `true`, seul l'identifiant le plus précis est accepté
     *                            (ex. SIRET en France, pas SIREN). Par défaut `false`.
     *
     * @return bool `true` si la valeur est potentiellement valide, `false` sinon.
     */
    public function isValidCompanyIdentifier(string $value, bool $preciseOnly = false): bool
    {
        // - Si on a pas de données, on part du principe
        //   que c'est valide si non vide...
        $metadataClass = $this->getMetadataClass();
        if ($metadataClass === null) {
            return V::notEmpty()->validate($value);
        }

        $identifiers = $metadataClass::getCompanyIdentifiers();
        if ($preciseOnly) {
            $identifiers = array_filter($identifiers, (
                static fn ($identifier) => $identifier['isPrecise']
            ));
        }

        return Arr::some($identifiers, static fn ($identifier) => (
            preg_match($identifier['pattern'], $value) > 0
        ));
    }

    /**
     * Retourne le schema d'un identifiant de société.
     *
     * @param string $value L'identifiant dont on veut récupérer le "schema".
     *
     * @return IdentifierScheme|null Le schema, ou `null` s'il n'a pas pu être récupéré.
     */
    public function getCompanyIdentifierScheme(string $value): IdentifierScheme|null
    {
        $metadata = $this->getCompanyIdentifierMetadata($value);
        return $metadata !== null ? $metadata['scheme'] : null;
    }

    /**
     * Normalise un identifiant de société.
     *
     * @param string $value L'identifiant à normaliser.
     *
     * @return string L'identifiant, normalisé.
     */
    public function normalizeCompanyIdentifier(string $value): string
    {
        $metadata = $this->getCompanyIdentifierMetadata($value);
        return $metadata === null ? $value : $metadata['value'];
    }

    /**
     * Permet de récupérer les formes juridiques liées au pays.
     *
     * @return list<LegalTypeInterface> La liste des formes juridiques.
     */
    public function getLegalTypes(): array
    {
        $metadataClass = $this->getMetadataClass();
        return $metadataClass !== null
            ? $metadataClass::getLegalTypes()
            : [];
    }

    /**
     * La forme juridique doit-elle être affichée sur les documents ?
     *
     * @return bool `true` si oui, `false` sinon.
     */
    public function mustShowLegalType(): bool
    {
        $metadataClass = $this->getMetadataClass();
        return $metadataClass !== null
            ? $metadataClass::mustShowLegalType()
            : false;
    }

    /**
     * Le capital social doit-il être affiché sur les documents ?
     *
     * @return bool `true` si oui, `false` sinon.
     */
    public function mustShowShareCapital(): bool
    {
        $metadataClass = $this->getMetadataClass();
        return $metadataClass !== null
            ? $metadataClass::mustShowShareCapital()
            : false;
    }

    /**
     * La mention d'immatriculation au registre du commerce
     * doit-elle être affichée sur les documents ?
     *
     * @return bool `true` si oui, `false` sinon.
     */
    public function mustShowTradeRegister(): bool
    {
        $metadataClass = $this->getMetadataClass();
        return $metadataClass !== null
            ? $metadataClass::mustShowTradeRegister()
            : false;
    }

    /**
     * Retourne les mentions légales obligatoires (ou habituellement
     * attendues) pour les factures émises dans ce pays.
     *
     * @return list<LegalMention> Les mentions applicables pour ce pays.
     */
    public function getInvoiceLegalMentions(): array
    {
        $metadataClass = $this->getMetadataClass();
        return $metadataClass !== null
            ? $metadataClass::getInvoiceLegalMentions()
            : [];
    }

    /**
     * Le code d'activité doit-il être affiché sur les documents ?
     *
     * @return bool `true` si oui, `false` sinon.
     */
    public function canShowActivityCode(): bool
    {
        $metadataClass = $this->getMetadataClass();
        return $metadataClass !== null
            ? $metadataClass::canShowActivityCode()
            : false;
    }

    /**
     * Le pays a-t-il un système de T.V.A. simple ?
     *
     * Un système de T.V.A. simple implique qu'un seul taux de
     * T.V.A est appliqué à la fois (à l'inverse d'un système comme
     * celui en vigueur au Québec par exemple).
     *
     * @return ?bool `true` si le pays a un système de T.V.A. simple, `false`
     *               sinon et `null` si on a pas l'information.
     */
    public function hasSimpleVatSystem(): ?bool
    {
        $metadataClass = $this->getMetadataClass();
        if ($metadataClass !== null) {
            return $metadataClass::hasSimpleVatSystem();
        }

        return $this->isEuVatMember() ? true : null;
    }

    /**
     * Retourne les taux de T.V.A. autorisés pour le pays.
     *
     * @param ?bool $extended Dois-t'on retourner la liste étendue des taxes ?
     *
     * @return ?list<float> Liste des taux de T.V.A. autorisés, ou `null`
     *                      si on a pas l'information.
     */
    public function getVatRates(?bool $extended = true): ?array
    {
        $metadataClass = $this->getMetadataClass();
        return $metadataClass !== null
            ? $metadataClass::getVatRates($extended)
            : null;
    }

    /**
     * La forme juridique peut t'elle avoir un capital social ?
     *
     * @return bool `true` si oui, `false` sinon.
     */
    public function canHaveShareCapital(?LegalTypeInterface $legalType): bool
    {
        // - Si on ne connaît pas la forme juridique de l'entreprise,
        //   on part du principe qu'il peut y avoir un capital social.
        return $legalType?->canHaveShareCapital() ?? true;
    }

    /**
     * La forme juridique est-elle potentiellement non assujetti à la T.V.A. ?
     *
     * @return bool `true` si oui, `false` sinon.
     */
    public function maybeExemptedFromVAT(?LegalTypeInterface $legalType): bool
    {
        // - Si on ne connaît pas la forme juridique de l'entreprise,
        //   on part du principe qu'il peut y avoir un capital social.
        return $legalType?->maybeExemptedFromVAT() ?? false;
    }

    /**
     * Permet de récupérer les codes d'exemption de T.V.A globaux pour le pays.
     *
     * On entends par "global" un code qui s'applique à une organisation entière
     * (e.g. la franchise en base en France ou en Belgique).
     *
     * @return list<VatExemptionCodeInterface> La liste des codes d'exemption de T.V.A. globaux.
     */
    public function getGlobalVatExemptionCodes(): array
    {
        $metadataClass = $this->getMetadataClass();
        if ($metadataClass !== null) {
            return $metadataClass::getGlobalVatExemptionCodes();
        }

        return $this->isEuVatMember()
            ? VatExemptionCodeEu::globals()
            : [];
    }

    /**
     * Permet de récupérer les codes d'exemption de T.V.A. applicable aux lignes de facture pour le pays.
     *
     * @param ?TaxRegime $regime Le régime pour lequel on veut récupérer les codes d'exemption.
     *
     * @return list<VatExemptionCodeInterface> La liste des codes d'exemption de T.V.A. de ligne.
     */
    public function getLineVatExemptionCodes(?TaxRegime $regime = TaxRegime::EXEMPTED): array
    {
        $metadataClass = $this->getMetadataClass();
        if ($metadataClass !== null) {
            return $metadataClass::getLineVatExemptionCodes($regime);
        }

        return $this->isEuVatMember()
            ? VatExemptionCodeEu::lines($regime)
            : [];
    }

    /**
     * Permet de récupérer le code du pays de rattachement du présent pays.
     *
     * @return string Le code du pays, au format ISO 3166-1 alpha-2 du pays.
     */
    public function getInheritedCode(): string
    {
        return match ($this->code) {
            'GP', 'MQ', 'GF', 'YT', 'RE',
            'BL', 'MF', 'PM', 'WF', 'TF' => 'FR',
            default => $this->code,
        };
    }

    /**
     * Le numéro d'enregistrement (SIRET, BCE, ...) est-il
     * requis pour un vendeur dans le présent pays ?
     *
     * @return bool `true` si le numéro d'enregistrement est requis, `false` sinon.
     */
    public function requireSellerRegistrationId(): bool
    {
        $metadataClass = $this->getMetadataClass();
        return $metadataClass !== null
            ? $metadataClass::requireSellerRegistrationId()
            : false;
    }

    /**
     * Le numéro d'enregistrement (SIRET, BCE, ...) est-il
     * requis pour un acheteur "société" dans le présent pays ?
     *
     * @param Country|string|null $buyerCountry Pays de l'acheteur.
     *                                          Si non spécifié, le pays sera réputé être le pays courant.
     *
     * @return bool `true` si le numéro d'enregistrement est requis, `false` sinon.
     */
    public function requireBuyerRegistrationId(Country|string|null $buyerCountry = null): bool
    {
        $buyerCountry = is_string($buyerCountry)
            ? new Country($buyerCountry)
            : $buyerCountry;

        $metadataClass = $this->getMetadataClass();
        return $metadataClass !== null
            ? $metadataClass::requireBuyerRegistrationId($buyerCountry)
            : false;
    }

    /**
     * L'adresse est-elle requise pour un acheteur dans le pays ?
     *
     * @param bool $isCompany Est-ce que l'acheteur est une société ?
     *
     * @return bool `true` si l'adresse est requise, `false` sinon.
     */
    public function requireBuyerAddress(bool $isCompany): bool
    {
        $metadataClass = $this->getMetadataClass();
        return $metadataClass !== null
            ? $metadataClass::requireBuyerAddress($isCompany)
            : false;
    }

    /**
     * Est-ce qu'une facture peut-être générée pour cet acheteur ?
     *
     * @param BuyerInterface $buyer L'acheteur concerné.
     *
     * @return bool `true` si une facture peut-être générée, `false` sinon.
     */
    public function isInvoiceable(BuyerInterface $buyer): bool
    {
        $isCompany = $buyer->getBuyerType() === LegalEntityType::COMPANY;
        $buyerAddress = $buyer->getBuyerAddress();

        // - Si on a pas le pays, l'acheteur n'est pas facturable.
        $buyerCountry = $buyer->getBuyerAddress()?->getCountry();
        if ($buyerCountry === null) {
            return false;
        }

        // - Si l'adresse est obligatoire ou si elle a été (au moins partiellement)
        //   renseignée, on vérifie que les champs requis sont bien tous remplis
        //   et que les champs renseignés ont une valeur valide pour le pays.
        $isAddressRequired = $this->requireBuyerAddress($isCompany);
        $hasAnyAddressData = $buyerAddress !== null && Arr::some(
            $buyerCountry->getAddressFields(),
            static fn ($addressField) => (
                !empty($buyerAddress->getField($addressField['field']))
            ),
        );
        if ($isAddressRequired || $hasAnyAddressData) {
            if ($buyerAddress === null) {
                return false;
            }

            $isAddressValid = Arr::every(
                $buyerCountry->getAddressFields(),
                static function ($addressField) use ($buyerCountry, $buyerAddress, $isAddressRequired) {
                    $value = $buyerAddress->getField($addressField['field']);

                    if (empty($value)) {
                        return $isAddressRequired
                            ? !$addressField['required']
                            : true;
                    }

                    // - On vérifie les données si elles sont spécifiées.
                    return $addressField['field'] === AddressField::POSTAL_CODE
                        ? $buyerCountry->isValidPostalCode($value)
                        : mb_strlen($value) <= 191;
                },
            );
            if (!$isAddressValid) {
                return false;
            }
        }

        // - Si c'est un particulier, on est bon.
        if (!$isCompany) {
            return true;
        }

        // - Si le numéro d'enregistrement (e.g. SIREN) est requis ou non vide
        //   et qu'il est invalide, on ne peut pas facturer.
        $registrationId = $buyer->getBuyerRegistrationId();
        $shouldCheckRegistrationId = $this->requireBuyerRegistrationId($buyerCountry) || $registrationId !== null;
        if ($shouldCheckRegistrationId) {
            $isValidRegistrationId = V::create()
                ->registrationId($buyerCountry, preciseOnly: $buyer->isBuyerPublicEntity())
                ->validate($registrationId);

            if (!$isValidRegistrationId) {
                return false;
            }
        }

        // - Si l'entreprise a un numéro de T.V.A. spécifié mais invalide, on ne peut pas facturer.
        $vatNumber = $buyer->getBuyerVatNumber();
        if ($vatNumber !== null) {
            $isValidVatNumber = V::create()
                ->vatNumber($buyerCountry)
                ->validate($vatNumber);

            if (!$isValidVatNumber) {
                return false;
            }
        }

        // - Si le pays du vendeur utilise la facturation électronique, que l'organisation
        //   n'est pas hors champ de T.V.A. et que l'acheteur est dans le même pays
        //   (transaction domestique), on vérifie l'identifiant de routing.
        $isOutOfScopeOfVat = Config::get('organization.isVatExempted', false) && (
            Config::get('organization.vatExemptionCode') === null &&
            Config::get('organization.vatExemptionReason') === null
        );
        if (
            !$isOutOfScopeOfVat &&
            $this->useElectronicInvoices() &&
            $this->isSame($buyerCountry, withInherited: true)
        ) {
            $invoiceIdentifier = $buyer->getBuyerInvoiceIdentifier();
            $hasInvoiceIdentifier = (
                $invoiceIdentifier !== null
                    ? $buyerCountry->isValidInvoiceRoutingIdentifier($invoiceIdentifier)
                    : $buyerCountry->canInferDefaultInvoiceRoutingIdentifier()
            );
            if (!$hasInvoiceIdentifier) {
                return false;
            }
        }

        return true;
    }

    /**
     * Retourne les régimes de taxe applicables pour une ligne de devis ou facture.
     *
     * Les régimes sont retournés dans l'ordre de priorité, le premier étant le plus susceptible d'être utilisé.
     *
     * @param BuyerInterface $buyer     Le client lié.
     * @param bool           $isService `true` si c'est une ligne de service, `false` si c'est un bien.
     *
     * @return list<TaxRegime|StrictTaxRegime> La liste des régimes de taxes applicables.
     */
    public function getLineAvailableTaxRegimes(BuyerInterface $buyer, bool $isService): array
    {
        $metadataClass = $this->getMetadataClass();
        if ($metadataClass !== null) {
            return $metadataClass::getLineAvailableTaxRegimes($buyer, $isService);
        }

        $buyerCountry = $buyer->getBuyerAddress()?->getCountry() ?? Config::getMainCountry();
        $isCompany = $buyer->getBuyerType() === LegalEntityType::COMPANY;

        //
        // - B2B
        //

        if ($isCompany) {
            // - Si l'entreprise cliente est dans le même pays...
            if ($this->isSame($buyerCountry)) {
                return [TaxRegime::STANDARD, TaxRegime::EXEMPTED];
            }

            // - Si l'entreprise cliente est dans la même zone T.V.A...
            if ($this->isSameVatArea($buyerCountry)) {
                $hasVatNumber = $buyer->getBuyerVatNumber() !== null;

                // - Si l'entreprise client a un numéro de T.V.A. valide,
                //   => On ajoute les règles d'auto-liquidation (bien / service).
                if ($hasVatNumber) {
                    return [
                        (
                            $isService
                                ? TaxRegime::REVERSE_CHARGE
                                : TaxRegime::REVERSE_CHARGE_SUPPLY
                        ),
                        TaxRegime::STANDARD,
                        TaxRegime::EXEMPTED,
                    ];
                }

                // - Sinon, si pas de numéro de T.V.A., pas d'auto-liquidation possible.
                return [TaxRegime::STANDARD, TaxRegime::EXEMPTED];
            }

            // - Sinon, si c'est un autre pays...
            return [
                TaxRegime::EXPORT,
                TaxRegime::EXEMPTED,
                TaxRegime::STANDARD,
            ];
        }

        //
        // - B2C.
        //

        // - Si le client est dans le même pays, dans la même zone T.V.A ou que c'est un service...
        if ($this->isSame($buyerCountry) || $this->isSameVatArea($buyerCountry) || $isService) {
            return [TaxRegime::STANDARD, TaxRegime::EXEMPTED];
        }

        // - Sinon, si c'est un autre pays et que c'est un produit, export en priorité.
        return [
            TaxRegime::EXPORT,
            TaxRegime::STANDARD,
            TaxRegime::EXEMPTED,
        ];
    }

    /**
     * Retourne le régime de taxe par défaut pour une ligne de devis ou facture.
     *
     * @param BuyerInterface $buyer     Le client lié.
     * @param bool           $isService `true` si c'est une ligne de service, `false` si c'est un bien.
     *
     * @return TaxRegime|StrictTaxRegime Le régime par défaut pour la ligne.
     */
    public function getLineDefaultTaxRegime(BuyerInterface $buyer, bool $isService): TaxRegime|StrictTaxRegime
    {
        $availableRegimes = $this->getLineAvailableTaxRegimes($buyer, $isService);
        return array_shift($availableRegimes);
    }

    /**
     * Retourne les formats de e-invoicing utilisés pour le pays courant.
     *
     * @return list<ElectronicInvoiceFormat> Les formats e-invoicing possibles.
     */
    public function getElectronicInvoiceFormats(): array
    {
        $metadataClass = $this->getMetadataClass();
        return $metadataClass !== null
            ? $metadataClass::getElectronicInvoiceFormats()
            : [];
    }

    /**
     * Les factures dans ce pays doivent-elles être au format électronique quand c'est possible ?
     *
     * @return bool `true` si le pays utilise des factures électroniques, `false` sinon.
     */
    public function useElectronicInvoices(): bool
    {
        return !empty($this->getElectronicInvoiceFormats());
    }

    /**
     * Retourne la spécification UBL utilisée par le pays pour les factures électroniques.
     *
     * @return UblSpecification|null La spécification UBL, ou `null` si le pays
     *                               ne supporte pas la facturation électronique UBL.
     */
    public function getUblSpecification(): ?UblSpecification
    {
        if (!in_array(ElectronicInvoiceFormat::UBL, $this->getElectronicInvoiceFormats(), true)) {
            return null;
        }

        $metadataClass = $this->getMetadataClass();
        return $metadataClass !== null
            ? $metadataClass::getUblSpecification()
            : null;
    }

    /**
     * Retourne le cadre de facturation / type de processus métier à utiliser pour
     * une facture dans le cadre de la facturation électronique.
     *
     * @param Invoice $invoice La facture dont on veut récupérer le cadre de facturation.
     *
     * @return ?BusinessProcessTypeInterface Le type de processus métier déduit, ou `null` si on a pas l'information.
     */
    public function inferBusinessProcessType(Invoice $invoice): ?BusinessProcessTypeInterface
    {
        $metadataClass = $this->getMetadataClass();
        return $metadataClass !== null
            ? $metadataClass::inferBusinessProcessType($invoice)
            : null;
    }

    /**
     * Vérifie qu'une instance est équivalente à une autre.
     *
     * @param Country $otherCountry  L'autre instance à comparer à celle-ci.
     * @param bool    $withInherited Dois-t'on considérer les pays rattachés
     *                               comme correspondant au pays ?
     *
     * @return bool `true` si les instances sont équivalentes, `false` sinon.
     */
    public function isSame(Country $otherCountry, bool $withInherited = false): bool
    {
        return $withInherited
            ? $this->getInheritedCode() === $otherCountry->getInheritedCode()
            : $this->getCode() === $otherCountry->getCode();
    }

    /**
     * Indique si deux pays appartiennent à la même zone de T.V.A.
     *
     * @param Country $otherCountry L'autre instance à comparer à celle-ci.
     *
     * @return bool `true` si les deux pays sont membres d'un même zone T.V.A., `false` sinon.
     */
    public function isSameVatArea(Country $otherCountry): bool
    {
        $metadataClass = $this->getMetadataClass();
        if ($metadataClass !== null) {
            return $metadataClass::isSameVatArea($otherCountry);
        }

        // - Si ce sont les même pays, ils sont dans la même zone T.V.A.
        if ($this->isSame($otherCountry)) {
            return true;
        }

        // - Sinon, si ce sont des pays de la zone économique européenne.
        return $this->isEuVatMember() && $otherCountry->isEuVatMember();
    }

    /**
     * Tente de récupérer un pays depuis une valeur mixte.
     *
     * @param mixed $rawValue La valeur représentant potentiellement un pays.
     *
     * @return static|null Le pays résultant, ou `null` si la valeur ne correspond à rien.
     */
    public static function tryFrom(mixed $rawValue): static|null
    {
        if ($rawValue instanceof static) {
            return $rawValue;
        }

        if (!is_string($rawValue) || $rawValue === '') {
            return null;
        }

        // - Recherche pas code.
        $normalizedCode = strtoupper($rawValue);
        if (V::countryCode()->validate($normalizedCode)) {
            return new static($normalizedCode);
        }

        // - Recherche par nom
        $normalizedCountryName = Str::of($rawValue)
            ->transliterate(null)
            ->lower();
        foreach (self::all() as $country) {
            foreach (I18n::AVAILABLE_LANGUAGES as $locale) {
                $_normalizedCountryName = Str::of($country->getName($locale))
                    ->transliterate(null)
                    ->lower();

                if ($normalizedCountryName->exactly($_normalizedCountryName)) {
                    return $country;
                }
            }
        }

        return null;
    }

    /**
     * Retourne la liste des pays.
     *
     * @return list<static> La liste des pays.
     */
    public static function all(): array
    {
        $list = [
            //
            // - Francophones
            //

            'FR', 'BE', 'CH', 'CA', 'MC', 'LU',
            'GP', 'GF', 'MQ', 'YT', 'NC', 'PF',
            'RE', 'BL', 'MF', 'PM', 'TF', 'WF',

            //
            // - Non francophones
            //

            'AF', 'ZA', 'AL', 'DZ', 'DE', 'AD', 'AO', 'AI', 'AQ', 'AG', 'SA', 'AR',
            'AM', 'AW', 'AU', 'AT', 'AZ', 'BS', 'BH', 'BD', 'BB', 'BZ', 'BJ', 'BM',
            'BT', 'BY', 'MM', 'BO', 'BA', 'BW', 'BR', 'BN', 'BG', 'BF', 'BI', 'KH',
            'CM', 'CV', 'CL', 'CN', 'CY', 'VA', 'CO', 'KM', 'CG', 'KP', 'KR', 'CR',
            'CI', 'HR', 'CU', 'DK', 'DJ', 'DM', 'EG', 'AE', 'EC', 'ER', 'ES', 'EE',
            'SZ', 'PS', 'US', 'ET', 'FJ', 'FI', 'GA', 'GM', 'GE', 'GS', 'GH', 'GI',
            'GR', 'GD', 'GL', 'GU', 'GT', 'GG', 'GN', 'GQ', 'GW', 'GY', 'HT', 'HN',
            'HK', 'HU', 'BV', 'CX', 'IM', 'NF', 'AX', 'KY', 'CC', 'CK', 'FK', 'FO',
            'HM', 'MP', 'MH', 'SB', 'TC', 'IN', 'ID', 'IQ', 'IR', 'IE', 'IS', 'IL',
            'IT', 'JM', 'JP', 'JE', 'JO', 'KZ', 'KE', 'KG', 'KI', 'KW', 'LA', 'LS',
            'LV', 'LB', 'LR', 'LY', 'LI', 'LT', 'MO', 'MK', 'MG', 'MY', 'MW', 'MV',
            'ML', 'MT', 'MA', 'MU', 'MR', 'MX', 'FM', 'MD', 'MN', 'ME', 'MS', 'MZ',
            'NA', 'NR', 'NP', 'NI', 'NE', 'NG', 'NU', 'NO', 'NZ', 'OM', 'UG', 'UZ',
            'PK', 'PW', 'PA', 'PG', 'PY', 'NL', 'PE', 'PH', 'PN', 'PL', 'PR', 'PT',
            'QA', 'CF', 'CD', 'DO', 'CZ', 'RO', 'GB', 'RU', 'RW', 'EH', 'KN', 'SM',
            'VC', 'SH', 'LC', 'SV', 'WS', 'AS', 'ST', 'SN', 'RS', 'SC', 'SL', 'SG',
            'SK', 'SI', 'SO', 'SD', 'LK', 'SE', 'SR', 'SJ', 'SY', 'TJ', 'TW', 'TZ',
            'TD', 'IO', 'TH', 'TL', 'TG', 'TK', 'TO', 'TT', 'TN', 'TM', 'TR', 'TV',
            'UA', 'UY', 'VU', 'VE', 'VN', 'YE', 'ZM', 'ZW',
        ];

        return array_map(
            static fn (string $countryCode) => (
                new Country($countryCode)
            ),
            $list,
        );
    }

    public function __toString()
    {
        return $this->getCode();
    }

    /**
     * Permet de récupérer le pays sous forme d'une entité sérialisée en JSON.
     *
     * @return array Le pays sous forme d'une valeur sérialisée en JSON.
     */
    public function jsonSerialize(): mixed
    {
        return $this->__toString();
    }

    // ------------------------------------------------------
    // -
    // -    Méthodes internes
    // -
    // ------------------------------------------------------

    /**
     * Permet de récupérer les métadonnées d'un identifiant de société.
     *
     * @param string $value L'identifiant de société dont on veut récupérer les méta-données.
     *
     * @return array{ scheme: IdentifierScheme, value: string }|null Les méta-données, ou `null` si aucun identifiant ne correspond.
     */
    private function getCompanyIdentifierMetadata(string $value): array|null
    {
        $metadataClass = $this->getMetadataClass();
        if ($metadataClass === null) {
            return null;
        }

        $identifiers = $metadataClass::getCompanyIdentifiers();
        $identifierMetadata = Arr::first($identifiers, static fn ($identifier) => (
            preg_match($identifier['pattern'], $value) > 0
        ));
        if ($identifierMetadata === null) {
            return null;
        }

        $normalized = $identifierMetadata['normalize']($value);
        $isCompound = is_array($normalized);
        return [
            'scheme' => $identifierMetadata['scheme'],
            'value' => $isCompound ? $normalized['current'] : $normalized,
            'main' => $isCompound ? $normalized['main'] : $normalized,
        ];
    }

    /** @return ?class-string<CountryMetadataInterface> */
    private function getMetadataClass(): ?string
    {
        if (!isset($this->metadataClass)) {
            $baseNamespace = 'Loxya\\Support\\Data\\CountryMetadata\\';

            // - On cherche d'abord une classe propre au code du pays (e.g. DROM/COM)
            //   avant de retomber sur celle du pays de rattachement (e.g. France pour les DROM).
            $codes = array_values(array_unique([$this->code, $this->getInheritedCode()]));

            $this->metadataClass = null;
            foreach ($codes as $code) {
                $baseClassName = sprintf('CountryMetadata%s', ucfirst(strtolower($code)));
                $className = $baseNamespace . $baseClassName;
                if (class_exists($className)) {
                    $this->metadataClass = $className;
                    break;
                }
            }
        }
        return $this->metadataClass;
    }

    /**
     * Retourne le format d'adresse brut pour le pays.
     *
     * @return AddressFormat Format d'adresse associé au pays.
     */
    private function getRawAddressFormat(): AddressFormat
    {
        static $addressFormatCaches = [];

        return $addressFormatCaches[$this->code] ??= (new AddressFormatRepository())->get($this->code);
    }
}
