<?php
declare(strict_types=1);

namespace Loxya\Console\Command\Setup;

use Illuminate\Support\Collection;
use Loxya\Config\Config;
use Loxya\Config\Enums\BillingMode;
use Loxya\Config\Enums\ReturnPolicy;
use Loxya\Console\App as CliApp;
use Loxya\Kernel;
use Loxya\Models\Enums\Group;
use Loxya\Models\User;
use Loxya\Services\I18n;
use Loxya\Support\Addressing\AddressField;
use Loxya\Support\Arr;
use Loxya\Support\Country;
use Loxya\Support\Data\LegalType\LegalTypeFactory;
use Loxya\Support\Data\LegalType\LegalTypeInterface;
use Loxya\Support\Invoicing\PaymentMethod;
use Loxya\Support\Invoicing\VatExemptionCode\VatExemptionCodeFactory;
use Loxya\Support\Invoicing\VatExemptionCode\VatExemptionCodeInterface;
use Loxya\Support\Str;
use Loxya\Support\Validation\ValidationException;
use Loxya\Support\Validation\Validator as V;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\ArrayInput;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\BufferedOutput;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Terminal;
use function Laravel\Prompts\confirm;
use function Laravel\Prompts\error;
use function Laravel\Prompts\form;
use function Laravel\Prompts\pause;
use function Laravel\Prompts\select;
use function Laravel\Prompts\spin;
use function Laravel\Prompts\text;

#[AsCommand(name: 'install')]
final class InstallCommand extends Command
{
    private I18n $i18n;

    private static array $rawCurrencies;

    public function __construct(I18n $i18n, ?string $name = null)
    {
        parent::__construct($name);

        $this->i18n = $i18n;
    }

    protected function configure(): void
    {
        $this
            ->setDescription("Assistant d'installation de l'application.")
            ->setHelp(implode(PHP_EOL, [
                "Cette commande vous accompagnera dans l'installation de votre application Loxya.",
                "",
                "<info>bin/console install</info>",
            ]));
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        // - Intro.
        $this->renderIntro($output);

        //
        // - Helpers
        //

        $__ = $this->translateFactory();

        $heading = static function (string $message, bool $inForm = false) use ($output) {
            $output->writeln(sprintf("\n<fg=black;bg=cyan> %s </>", $message));

            if ($inForm) {
                $output->writeln('');
            }
        };

        $unspecifiedFields = new Collection();
        $whenAdvanced = static fn (string $name, \Closure $field, ?\Closure $condition = null) => [
            static function (array $responses) use ($name, $unspecifiedFields, $condition) {
                $shouldRun = (
                    $responses['shouldConfigureAdvanced'] &&
                    ($condition === null || $condition($responses))
                );
                $unspecifiedFields->put($name, !$shouldRun);
                return $shouldRun;
            },
            static fn (array $responses, mixed $previousResponse) => (
                $field($previousResponse)
            ),
            $name,
        ];

        //
        // - Données existantes
        //

        $isUpdate = Config::customConfigExists();
        $savedConfig = self::getSavedConfig();
        $getSavedValue = static fn (string $key, ?bool $useDefault = true): mixed => (
            Arr::get($savedConfig, $key, $useDefault ? Config::getDefault($key) : null)
        );

        $defaultSecretToken = $getSavedValue('JWTSecret', false) ?? (
            md5(uniqid('Loxya', true))
        );

        //
        // - Formulaire
        //

        $form = form();
        $form
            // - URL de l'application.
            ->text(
                name: 'baseUrl',
                label: $__('fields.base-url.label'),
                placeholder: $__('fields.base-url.placeholder'),
                hint: $__('fields.base-url.hint'),
                required: $__('global.mandatory-field'),
                default: (string) $getSavedValue('baseUrl', false),
                transform: static fn (string $value) => (
                    rtrim(trim($value), '/')
                ),
                validate: static fn (string $value) => (
                    V::notEmpty()->url()->diagnose($value)
                ),
            )

            // - Pays d'utilisation principal
            ->select(
                name: 'mainCountry',
                label: $__('fields.main-country.label'),
                options: $this->getAllCountries(),
                hint: $__('fields.main-country.hint'),
                required: $__('global.mandatory-field'),
                default: (string) $getSavedValue('mainCountry'),
            )

            // - Langue par défaut de l'application.
            ->add(
                function (array $responses, string|null $previousResponse) use ($__, $getSavedValue) {
                    $mainCountryLanguage = (new Country($responses['mainCountry']))
                        ->getFirstSupportedLanguage();

                    return select(
                        label: $__('fields.default-lang.label'),
                        options: [
                            'fr' => 'Français',
                            'en' => 'English',
                        ],
                        hint: $__('fields.default-lang.hint'),
                        required: $__('global.mandatory-field'),
                        default: (
                            $previousResponse
                                ?? $getSavedValue('defaultLang', false)
                                ?? $mainCountryLanguage
                                ?? $this->i18n->getLanguage()
                        ),
                    );
                },
                name: 'defaultLang',
            )

            // - Proposition de changer la langue de l'assistant si la langue
            //   sélectionnée à l'étape précédente n'est pas la langue courante.
            ->addIf(
                fn (array $responses) => $responses['defaultLang'] !== $this->i18n->getLanguage(),
                function (array $responses) {
                    $i18n = new I18n($responses['defaultLang']);
                    $__ = $this->translateFactory($i18n);

                    $changeLanguage = confirm(
                        label: $__('change-wizard-language'),
                        yes: $__('global.yes'),
                        no: $__('global.no'),
                        default: true,
                    );
                    if ($changeLanguage) {
                        $this->i18n = $i18n;
                    }
                },
                name: '__changeWizardLanguage',
                ignoreWhenReverting: true,
            )

            // - Mode de facturation / d'utilisation.
            ->add(
                static function (array $responses, BillingMode|null $previousResponse) use ($__, $getSavedValue) {
                    $rawValue = select(
                        label: $__('fields.billing-mode.label'),
                        options: [
                            BillingMode::ALL->value => $__('fields.billing-mode.options.all'),
                            BillingMode::PARTIAL->value => $__('fields.billing-mode.options.partial'),
                            BillingMode::NONE->value => $__('fields.billing-mode.options.none'),
                        ],
                        required: $__('global.mandatory-field'),
                        default: (
                            $previousResponse?->value
                                ?? $getSavedValue('billingMode')?->value
                        ),
                    );
                    return BillingMode::from($rawValue);
                },
                name: 'billingMode',
            )

            // - Devise de l'application.
            ->add(
                function (array $responses, string|null $previousResponse) use ($__, $getSavedValue) {
                    $mainCountryCurrency = (new Country($responses['mainCountry']))
                        ->getMainCurrency();

                    return select(
                        label: $__('fields.currency.label'),
                        options: $this->getAllCurrencies(),
                        required: $__('global.mandatory-field'),
                        hint: (
                            $responses['billingMode'] === BillingMode::NONE
                                ? $__('fields.currency.hint.without-billing')
                                : $__('fields.currency.hint.with-billing')
                        ),
                        default: (
                            $previousResponse
                                ?? $getSavedValue('currency', false)
                                ?? $mainCountryCurrency
                                ?? Config::getDefault('currency')
                        ),
                    );
                },
                name: 'currency',
            )

            //
            // - Organisation
            //

            ->add(
                function (array $responses, array|null $previousResponses) use ($heading, $__, $getSavedValue) {
                    $previousResponses ??= [];
                    $withBilling = $responses['billingMode'] !== BillingMode::NONE;
                    $heading($__('headings.organization-information'), inForm: true);

                    $unspecifiedFields = new Collection();
                    $when = static fn (\Closure $condition, \Closure $field, string $name) => [
                        static function (array $responses) use ($name, $unspecifiedFields, $condition) {
                            $shouldRun = $condition($responses);
                            $unspecifiedFields->put($name, !$shouldRun);
                            return $shouldRun;
                        },
                        static fn (array $responses, mixed $previousResponse) => (
                            $field($responses, $previousResponse)
                        ),
                        $name,
                    ];

                    // Note: Penser à mettre à jour les champs correspondants dans les devis
                    //       et factures lors de la mise à jour des champs ci-dessous.
                    $data = form()
                        // - Nom de l'organisation.
                        ->text(
                            name: 'name',
                            label: (
                                $withBilling
                                    ? $__('fields.organization.name.with-billing')
                                    : $__('fields.organization.name.without-billing')
                            ),
                            required: $__('global.mandatory-field'),
                            default: (
                                $previousResponses['name']
                                    ?? (string) $getSavedValue('organization.name')
                            ),
                            transform: static fn (string $value) => trim($value),
                            validate: static fn (string $value) => (
                                V::notEmpty()->length(2, 100)->diagnose($value)
                            ),
                        )

                        // - Pays de l'organisation.
                        ->select(
                            name: 'country',
                            label: $__('fields.organization.country.label'),
                            options: $this->getAllCountries(),
                            required: $__('global.mandatory-field'),
                            default: (
                                $previousResponses['country']
                                    ?? $getSavedValue('organization.country', false)
                                    ?? $responses['mainCountry']
                            ),
                            validate: static function (string $value) use ($responses, $__) {
                                $organizationCountryCurrencies = (new Country($value))->getCurrencies();
                                if (
                                    !empty($organizationCountryCurrencies) &&
                                    !in_array($responses['currency'], $organizationCountryCurrencies, true)
                                ) {
                                    return $__('fields.organization.country.errors.currency-mismatch');
                                }
                                return null;
                            },
                        )

                        // - Numéro d'enregistrement (SIRET, etc).
                        ->add(
                            // phpcs:ignore Generic.Files.LineLength.TooLong
                            static function (array $responses, string|null $previousResponse) use ($__, $withBilling, $getSavedValue) {
                                $country = new Country($responses['country']);
                                $isMandatory = $withBilling && $country->requireSellerRegistrationId();

                                $rawValue = text(
                                    label: $__([
                                        sprintf('fields.organization.registration-id.%s', $responses['country']),
                                        'fields.organization.registration-id.generic',
                                    ]),
                                    required: $isMandatory ? $__('global.mandatory-field') : false,
                                    hint: !$isMandatory ? $__('global.optional') : '',
                                    default: (
                                        $previousResponse
                                            ?? (string) $getSavedValue('organization.registrationId')
                                    ),
                                    transform: static fn (string $value) => trim($value),
                                    validate: static function (string $value) use ($isMandatory, $responses) {
                                        if (empty($value) && !$isMandatory) {
                                            return null;
                                        }

                                        return V::create()
                                            ->notEmpty()
                                            ->length(null, 50)
                                            ->registrationId($responses['country'], preciseOnly: true)
                                            ->diagnose($value);
                                    },
                                );
                                if (empty($rawValue) && !$isMandatory) {
                                    return null;
                                }

                                $country = new Country($responses['country']);
                                return $country->normalizeCompanyIdentifier($rawValue);
                            },
                            name: 'registrationId',
                        )

                        // - Forme juridique
                        ->addIf(...$when(
                            static function (array $responses) {
                                $country = new Country($responses['country']);
                                if (!$country->mustShowLegalType()) {
                                    return false;
                                }
                                return !empty($country->getLegalTypes());
                            },
                            // phpcs:ignore Generic.Files.LineLength.TooLong
                            static function (array $responses, LegalTypeInterface|null $previousResponse) use ($__, $getSavedValue) {
                                $country = new Country($responses['country']);

                                $options = Arr::mapWithKeys(
                                    $country->getLegalTypes(),
                                    static function (LegalTypeInterface $type) use ($__) {
                                        $label = $__(sprintf('global.legals.legal-types.%s.long', $type->value));
                                        return [$type->value => $label];
                                    },
                                );
                                $options['__OTHER__'] = $__('global.other');

                                $rawValue = select(
                                    label: $__('fields.organization.legal-type'),
                                    options: $options,
                                    required: $__('global.mandatory-field'),
                                    default: (
                                        $previousResponse?->value
                                            ?? (string) $getSavedValue('organization.legalType')?->value
                                    ),
                                );

                                return $rawValue && $rawValue !== '__OTHER__'
                                    ? LegalTypeFactory::from($rawValue)
                                    : null;
                            },
                            name: 'legalType',
                        ))

                        // - Capital social
                        ->addIf(...$when(
                            static function (array $responses) {
                                $country = new Country($responses['country']);
                                if (!$country->mustShowShareCapital()) {
                                    return false;
                                }
                                return $country->canHaveShareCapital($responses['legalType'] ?? null);
                            },
                            static fn (array $responses, string|null $previousResponse) => (
                                text(
                                    label: $__('fields.organization.share-capital.label'),
                                    hint: $__('fields.organization.share-capital.hint'),
                                    required: $__('global.mandatory-field'),
                                    default: (
                                        $previousResponse
                                            ?? (string) $getSavedValue('organization.shareCapital')
                                    ),
                                    validate: static fn (string $value) => (
                                        V::create()
                                            ->decimal(14, 2)
                                            ->min(0)
                                            ->diagnose($value)
                                    ),
                                )
                            ),
                            name: 'shareCapital',
                        ))

                        // - Ville du registre du commerce.
                        ->addIf(...$when(
                            static function (array $responses) {
                                $country = new Country($responses['country']);
                                return $country->mustShowTradeRegister();
                            },
                            // phpcs:ignore Generic.Files.LineLength.TooLong
                            static function (array $responses, string|null $previousResponse) use ($__, $getSavedValue) {
                                $rawValue = text(
                                    label: $__('fields.organization.trade-registry-city.label'),
                                    hint: $__('fields.organization.trade-registry-city.hint'),
                                    default: (
                                        $previousResponse
                                            ?? (string) $getSavedValue('organization.tradeRegistryCity')
                                    ),
                                    transform: static fn (string $value) => trim($value),
                                    validate: static fn (string $value) => (
                                        V::length(null, 50)->diagnose($value)
                                    ),
                                );
                                return !empty($rawValue) ? $rawValue : null;
                            },
                            name: 'tradeRegistryCity',
                        ))

                        // - Type d'activité
                        ->addIf(...$when(
                            static function (array $responses) {
                                $country = new Country($responses['country']);
                                return $country->canShowActivityCode();
                            },
                            // phpcs:ignore Generic.Files.LineLength.TooLong
                            static function (array $responses, string|null $previousResponse) use ($__, $getSavedValue) {
                                $rawValue = text(
                                    label: $__([
                                        sprintf('fields.organization.activity-code.%s', $responses['country']),
                                        'fields.organization.activity-code.generic',
                                    ]),
                                    hint: $__('global.optional'),
                                    default: (
                                        $previousResponse
                                            ?? (string) $getSavedValue('organization.activityCode')
                                    ),
                                    validate: static function (string $value) use ($responses) {
                                        if (empty($value)) {
                                            return null;
                                        }

                                        return V::create()
                                            ->length(null, 30)
                                            ->activityCode($responses['country'])
                                            ->diagnose($value);
                                    },
                                );
                                if (empty($rawValue)) {
                                    return null;
                                }

                                $country = new Country($responses['country']);
                                return $country->normalizeActivityCode($rawValue);
                            },
                            name: 'activityCode',
                        ))

                        // - Est exempté de TVA ?
                        ->addIf(...$when(
                            static fn () => $withBilling,
                            // phpcs:ignore Generic.Files.LineLength.TooLong
                            static function (array $responses, bool|null $previousResponse) use ($__, $getSavedValue) {
                                $country = new Country($responses['country']);

                                $isSubjected = confirm(
                                    label: $__('fields.organization.is-vat-subjected'),
                                    yes: $__('global.yes'),
                                    no: $__('global.no'),
                                    default: !(
                                        $previousResponse
                                            ?? $getSavedValue('organization.isVatExempted')
                                            ?? $country->maybeExemptedFromVAT($responses['legalType'] ?? null)
                                    ),
                                );

                                return !$isSubjected;
                            },
                            name: 'isVatExempted',
                        ))

                        // - Raison d'exemption de T.V.A (code).
                        ->addIf(...$when(
                            static function (array $responses) use ($withBilling) {
                                if (!$withBilling || !$responses['isVatExempted']) {
                                    return false;
                                }

                                $country = new Country($responses['country']);
                                return !empty($country->getGlobalVatExemptionCodes());
                            },
                            // phpcs:ignore Generic.Files.LineLength.TooLong
                            static function (array $responses, VatExemptionCodeInterface|null $previousResponse) use ($__, $getSavedValue) {
                                $country = new Country($responses['country']);

                                $options = Arr::mapWithKeys(
                                    $country->getGlobalVatExemptionCodes(),
                                    static function (VatExemptionCodeInterface $type) use ($__) {
                                        // phpcs:ignore Generic.Files.LineLength.TooLong
                                        $label = $__(sprintf('global.legals.vat-exemptions.%s.label', $type->value));
                                        return [$type->value => $label];
                                    },
                                ) + ['__OTHER__' => $__('global.other-specify')];
                                $rawValue = select(
                                    label: $__('fields.organization.vat-exemption-reason.label'),
                                    hint: $__('fields.organization.vat-exemption-reason.hint'),
                                    required: $__('global.mandatory-field'),
                                    options: $options,
                                    default: (
                                        $previousResponse?->value
                                            ?? (string) $getSavedValue('organization.vatExemptionCode')?->value
                                    ),
                                );

                                return $rawValue !== '__OTHER__'
                                    ? VatExemptionCodeFactory::from($rawValue)
                                    : null;
                            },
                            name: 'vatExemptionCode',
                        ))

                        // - Raison d'exemption de T.V.A (custom)
                        ->addIf(...$when(
                            static fn (array $responses) => (
                                $withBilling &&
                                $responses['isVatExempted'] &&
                                ($responses['vatExemptionCode'] ?? null) === null
                            ),
                            // phpcs:ignore Generic.Files.LineLength.TooLong
                            static function (array $responses, string|null $previousResponse) use ($__, $getSavedValue) {
                                $rawValue = text(
                                    label: $__('fields.organization.vat-exemption-reason-custom.label'),
                                    hint: $__('fields.organization.vat-exemption-reason-custom.hint'),
                                    default: (
                                        $previousResponse
                                            ?? (string) $getSavedValue('organization.vatExemptionReason')
                                    ),
                                );
                                return $rawValue !== '' ? $rawValue : null;
                            },
                            name: 'vatExemptionReason',
                        ))

                        // - Numéro de T.V.A.
                        ->addIf(...$when(
                            static fn (array $responses) => $withBilling && !$responses['isVatExempted'],
                            // phpcs:ignore Generic.Files.LineLength.TooLong
                            static function (array $responses, string|null $previousResponse) use ($__, $getSavedValue) {
                                $country = new Country($responses['country']);
                                $rawValue = text(
                                    label: $__([
                                        sprintf('fields.organization.vat-number.%s', $responses['country']),
                                        'fields.organization.vat-number.generic',
                                    ]),
                                    required: $__('global.mandatory-field'),
                                    default: (
                                        $previousResponse
                                            ?? $getSavedValue('organization.vatNumber')
                                            ?? (string) (
                                                $responses['registrationId'] !== null
                                                    ? $country->inferVatNumberFromCompanyIdentifier(
                                                        $responses['registrationId'],
                                                    )
                                                    : null
                                            )
                                    ),
                                    validate: static fn (string $value) => (
                                        V::create()
                                            ->vatNumber($responses['country'])
                                            ->diagnose($value)
                                    ),
                                );
                                return $country->normalizeVatNumber($rawValue);
                            },
                            name: 'vatNumber',
                        ))

                        // - Option pour le paiement de la TVA d'après les débits ?
                        ->addIf(...$when(
                            static fn (array $responses) => $withBilling && !$responses['isVatExempted'],
                            static fn (array $responses, bool|null $previousResponse) => (
                                confirm(
                                    label: $__('fields.organization.vat-due-on-invoice.label'),
                                    hint: $__('fields.organization.vat-due-on-invoice.hint'),
                                    yes: $__('global.yes'),
                                    no: $__('global.no'),
                                    default: (
                                        $previousResponse
                                            ?? (bool) $getSavedValue('organization.isVatDueOnInvoice')
                                    ),
                                )
                            ),
                            name: 'isVatDueOnInvoice',
                        ))

                        // - Adresse.
                        ->add(
                            // phpcs:ignore Generic.Files.LineLength.TooLong
                            static function (array $responses, array|null $subPreviousResponses) use ($__, $withBilling, $getSavedValue) {
                                $subPreviousResponses ??= [];
                                $country = new Country($responses['country']);

                                $addressForm = form();
                                $addressFields = $country->getAddressFields();
                                foreach ($addressFields as $addressField) {
                                    $isRequired = $withBilling && $addressField['required'];

                                    $field = match ($addressField['field']) {
                                        AddressField::ADDRESS_LINE1 => [
                                            'name' => 'street.0',
                                            'label' => $__('fields.organization.street.0'),
                                        ],
                                        AddressField::ADDRESS_LINE2 => [
                                            'name' => 'street.1',
                                            'label' => $__('fields.organization.street.1'),
                                        ],
                                        AddressField::POSTAL_CODE => [
                                            'name' => 'postalCode',
                                            'label' => $__(sprintf(
                                                'fields.organization.postal-code.%s',
                                                $addressField['type']->value,
                                            )),
                                        ],
                                        AddressField::ADMINISTRATIVE_AREA => [
                                            'name' => 'administrativeArea',
                                            'label' => $__(sprintf(
                                                'fields.organization.administrative-area.%s',
                                                $addressField['type']->value,
                                            )),
                                        ],
                                        AddressField::LOCALITY => [
                                            'name' => 'locality',
                                            'label' => $__(sprintf(
                                                'fields.organization.locality.%s',
                                                $addressField['type']->value,
                                            )),
                                        ],
                                    };

                                    $addressForm->text(
                                        name: $field['name'],
                                        label: $field['label'],
                                        required: $isRequired ? $__('global.mandatory-field') : false,
                                        hint: !$isRequired ? $__('global.optional') : '',
                                        default: (
                                            $subPreviousResponses[$field['name']]
                                                ?? (string) $getSavedValue(sprintf('organization.%s', $field['name']))
                                        ),
                                        transform: static fn (string $value) => trim($value),
                                        // phpcs:ignore Generic.Files.LineLength.TooLong
                                        validate: static function (string $value) use ($isRequired, $addressField, $responses) {
                                            if (empty($value) && !$isRequired) {
                                                return null;
                                            }

                                            return $addressField['field'] === AddressField::POSTAL_CODE
                                                ? V::notEmpty()->postalCode($responses['country'])->diagnose($value)
                                                : V::notEmpty()->diagnose($value);
                                        },
                                    );
                                }

                                return $addressForm->submit();
                            },
                            name: 'address',
                        )
                        ->add(
                            // phpcs:ignore Generic.Files.LineLength.TooLong
                            static function (array $responses, string|null $previousResponse) use ($__, $getSavedValue) {
                                $rawValue = text(
                                    label: $__('fields.organization.phone.label'),
                                    hint: $__('fields.organization.phone.hint'),
                                    default: $previousResponse ?? (string) $getSavedValue('organization.phone'),
                                    transform: static fn (string $value) => trim($value),
                                    validate: static fn (string $value) => (
                                        V::optional(V::phone($responses['country']))->diagnose($value)
                                    ),
                                );
                                if ($rawValue === '') {
                                    return null;
                                }

                                $country = new Country($responses['country']);
                                return $country->normalizePhoneNumber($rawValue);
                            },
                            name: 'phone',
                        )
                        ->add(
                            // phpcs:ignore Generic.Files.LineLength.TooLong
                            static function (array $responses, string|null $previousResponse) use ($__, $getSavedValue) {
                                $rawValue = text(
                                    label: $__('fields.organization.email.label'),
                                    hint: $__('fields.organization.email.hint'),
                                    default: $previousResponse ?? (string) $getSavedValue('organization.email'),
                                    transform: static fn (string $value) => trim($value),
                                    validate: static fn (string $value) => (
                                        V::optional(V::email())->diagnose($value)
                                    ),
                                );
                                return $rawValue !== '' ? $rawValue : null;
                            },
                            name: 'email',
                        )
                        ->submit();

                    // - Lignes de la rue.
                    $data['address']['street'] = array_values(array_filter([
                        Arr::pull($data['address'], 'street.0'),
                        Arr::pull($data['address'], 'street.1'),
                    ]));

                    return array_filter(
                        Arr::except([...$data, ...$data['address']], ['address']),
                        static fn (string $key) => (
                            !($unspecifiedFields[$key] ?? false)
                        ),
                        \ARRAY_FILTER_USE_KEY,
                    );
                },
                name: 'organization',
            )

            //
            // - Base de données
            //

            ->add(
                // phpcs:ignore Generic.Files.LineLength.TooLong
                static function (array $responses, array|null $previousResponses) use ($__, $heading, $isUpdate, $getSavedValue) {
                    $heading($__('headings.database-configuration'), inForm: true);

                    $doPrompt = static fn ($previousResponses) => (
                        form()
                            ->text(
                                name: 'host',
                                label: $__('fields.database.fields.host'),
                                required: $__('global.mandatory-field'),
                                default: (
                                    $previousResponses['host']
                                        ?? (string) $getSavedValue('db.host')
                                ),
                            )
                            ->text(
                                name: 'username',
                                label: $__('fields.database.fields.username'),
                                required: $__('global.mandatory-field'),
                                default: (
                                    $previousResponses['username']
                                        ?? (string) $getSavedValue('db.username')
                                ),
                            )
                            ->password(
                                name: 'password',
                                label: $__('fields.database.fields.password.label'),
                                placeholder: $isUpdate ? $__('fields.database.fields.password.update.placeholder') : '',
                                hint: $isUpdate ? $__('fields.database.fields.password.update.hint') : '',
                                required: $isUpdate ? false : $__('global.mandatory-field'),
                                transform: static fn (string $value) => (
                                    $isUpdate && empty($value)
                                        ? (string) $getSavedValue('db.password')
                                        : $value
                                ),
                            )
                            ->text(
                                name: 'database',
                                label: $__('fields.database.fields.database'),
                                required: $__('global.mandatory-field'),
                                default: (
                                    $previousResponses['database']
                                        ?? (string) $getSavedValue('db.database')
                                ),
                            )
                            ->text(
                                name: 'port',
                                label: $__('fields.database.fields.port'),
                                required: $__('global.mandatory-field'),
                                default: (
                                    array_key_exists('port', $previousResponses)
                                        ? (string) $previousResponses['port']
                                        : (string) $getSavedValue('db.port')
                                ),
                                validate: static fn (string $value) => (
                                    V::intVal()->diagnose($value)
                                ),
                            )
                            ->text(
                                name: 'prefix',
                                label: $__('fields.database.fields.prefix.label'),
                                hint: $__('fields.database.fields.prefix.hint'),
                                default: (
                                    $previousResponses['prefix']
                                        ?? (string) $getSavedValue('db.prefix')
                                ),
                            )
                            ->submit()
                    );
                    $previousResponses ??= [];
                    while (1 === 1) {
                        $data = $doPrompt($previousResponses);
                        $data['port'] = (int) $data['port'];
                        $previousResponses = $data;

                        try {
                            $pdo = new \PDO(
                                vsprintf('mysql:host=%s;port=%s;dbname=%s', [
                                    $data['host'],
                                    $data['port'],
                                    $data['database'],
                                ]),
                                $data['username'],
                                $data['password'],
                                [
                                    \PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION,
                                    \PDO::ATTR_DEFAULT_FETCH_MODE => \PDO::FETCH_ASSOC,
                                    \PDO::ATTR_PERSISTENT => false,
                                    \PDO::ATTR_TIMEOUT => 3,
                                ],
                            );

                            // - Test trivial pour tester que la connexion est utilisable.
                            $pdo->query('SELECT 1');

                            // - On libère explicitement la connexion.
                            unset($pdo);
                        } catch (\PDOException $e) {
                            error(match ($e->getCode()) {
                                2002 => $__('fields.database.errors.host-unreachable'),
                                1045 => $__('fields.database.errors.bad-credentials'),
                                1049 => $__('fields.database.errors.missing-database'),
                                default => $__('fields.database.errors.generic'),
                            });
                            continue;
                        } catch (\Throwable) {
                            error($__('fields.database.errors.generic'));
                            continue;
                        }
                        return $data;
                    }
                },
                name: 'db',
            )

            //
            // - Paramètres des devis.
            //

            ->addIf(
                static function (array $responses) use ($unspecifiedFields) {
                    $shouldRun = $responses['billingMode'] !== BillingMode::NONE;
                    $unspecifiedFields->put('estimates', !$shouldRun);
                    return $shouldRun;
                },
                // phpcs:ignore Generic.Files.LineLength.TooLong
                static function (array $responses, array|null $previousResponses) use ($__, $heading, $getSavedValue) {
                    $heading($__('headings.estimates-parameters'), inForm: true);

                    $previousResponses ??= [];

                    // - Valeur actuelle / options de la durée de validité.
                    $predefinedValidityDays = ['10', '15', '30', '60', '90'];
                    $currentValidityDays = (
                        array_key_exists('validityDays', $previousResponses)
                            ? (string) $previousResponses['validityDays']
                            : (string) $getSavedValue('estimates.validityDays')
                    );
                    $defaultValidityDaysChoice = (
                        in_array($currentValidityDays, $predefinedValidityDays, true)
                            ? $currentValidityDays
                            : '__CUSTOM__'
                    );
                    $defaultValidityDaysCustom = (
                        $defaultValidityDaysChoice === '__CUSTOM__'
                            ? $currentValidityDays
                            : ''
                    );

                    $data = form()
                        // - Durée de validité par défaut.
                        ->select(
                            name: 'validityDaysChoice',
                            label: $__('fields.estimates.validity-days.label'),
                            hint: $__('fields.estimates.validity-days.hint'),
                            options: Arr::mapWithKeys(
                                $predefinedValidityDays,
                                static function (string $days) use ($__) {
                                    $label = $__('fields.estimates.validity-days.options.days', $days);
                                    return [$days => $label];
                                },
                            ) + ['__CUSTOM__' => $__('fields.estimates.validity-days.options.custom')],
                            required: $__('global.mandatory-field'),
                            default: $defaultValidityDaysChoice,
                        )
                        // - Durée de validité personnalisée.
                        ->addIf(
                            static fn (array $subResponses) => (
                                $subResponses['validityDaysChoice'] === '__CUSTOM__'
                            ),
                            // phpcs:ignore Generic.Files.LineLength.TooLong
                            static fn (array $subResponses, string|null $previousResponse) => (
                                text(
                                    label: $__('fields.estimates.validity-days.custom-label'),
                                    required: $__('global.mandatory-field'),
                                    default: $previousResponse ?? $defaultValidityDaysCustom,
                                    validate: static fn (string $value) => (
                                        V::create()
                                            ->intVal()
                                            ->between(1, 365)
                                            ->diagnose($value)
                                    ),
                                )
                            ),
                            name: 'validityDaysCustom',
                        )
                        ->submit();

                    // - Durée de validité "finale".
                    $validityDays = $data['validityDaysChoice'] !== '__CUSTOM__'
                        ? (int) $data['validityDaysChoice']
                        : (int) $data['validityDaysCustom'];

                    return [
                        'validityDays' => $validityDays,
                    ];
                },
                name: 'estimates',
            )

            //
            // - Paramètres de la facturation.
            //

            ->addIf(
                static function (array $responses) use ($unspecifiedFields) {
                    $shouldRun = $responses['billingMode'] !== BillingMode::NONE;
                    $unspecifiedFields->put('invoices', !$shouldRun);
                    return $shouldRun;
                },
                // phpcs:ignore Generic.Files.LineLength.TooLong
                static function (array $responses, array|null $previousResponses) use ($__, $heading, $getSavedValue) {
                    $heading($__('headings.invoicing-parameters'), inForm: true);

                    $previousResponses ??= [];

                    // - Valeur actuelle / options du délai de paiement.
                    $predefinedTermDays = ['0', '10', '15', '30', '45', '60'];
                    $currentTermDays = (
                        array_key_exists('paymentTermDays', $previousResponses)
                            ? (string) $previousResponses['paymentTermDays']
                            : (string) $getSavedValue('invoices.paymentTermDays')
                    );
                    $defaultTermDaysChoice = (
                        in_array($currentTermDays, $predefinedTermDays, true)
                            ? $currentTermDays
                            : '__CUSTOM__'
                    );
                    $defaultTermDaysCustom = (
                        $defaultTermDaysChoice === '__CUSTOM__'
                            ? $currentTermDays
                            : ''
                    );

                    // - Valeur actuelle des méthodes de paiement.
                    $rawCurrentPaymentMethods = (
                        array_key_exists('paymentMethods', $previousResponses)
                            ? $previousResponses['paymentMethods']
                            : $getSavedValue('invoices.paymentMethods')
                    );
                    $currentPaymentMethods = [];
                    if ($rawCurrentPaymentMethods !== null) {
                        foreach ($rawCurrentPaymentMethods as $method => $value) {
                            if (is_numeric($method)) {
                                $method = $value;
                                $value = true;
                            }
                            $currentPaymentMethods[$method] = $value;
                        }
                    }

                    $data = form()
                        // - Adresse électronique d'envoi des e-factures.
                        ->addIf(
                            static function () use ($responses) {
                                $country = new Country($responses['organization']['country']);
                                if (!$country->useElectronicInvoices()) {
                                    return false;
                                }

                                // - Si elle n'est pas exemptée, on affiche le champ quoi qu'il en soit.
                                $isVatExempted = $responses['organization']['isVatExempted'];
                                if (!$isVatExempted) {
                                    return true;
                                }

                                // - Sinon s'il y a une raison d'exemption, elle reste dans le champ
                                //   d'application de la T.V.A. (bien qu'exemptée) donc on affiche le champ.
                                //   (c'est l'absence de raison qui donne le régime `OUT_OF_SCOPE` dans le logiciel)
                                $exemptionCode = $responses['organization']['vatExemptionCode'] ?? null;
                                $exemptionReason = $responses['organization']['vatExemptionReason'] ?? null;
                                return $exemptionCode !== null || $exemptionReason !== null;
                            },
                            // phpcs:ignore Generic.Files.LineLength.TooLong
                            static function (array $subResponses, string|null $previousResponse) use ($__, $getSavedValue, $responses) {
                                $country = new Country($responses['organization']['country']);
                                $rawValue = text(
                                    label: $__('fields.invoices.routing-identifier.label'),
                                    hint: $__('fields.invoices.routing-identifier.hint'),
                                    required: $__('global.mandatory-field'),
                                    default: (
                                        $previousResponse
                                            ?? $getSavedValue('invoices.routingIdentifier')
                                            ?? (string) (
                                                $responses['organization']['registrationId'] !== null
                                                    ? $country->inferDefaultInvoiceRoutingIdentifier(
                                                        $responses['organization']['registrationId'],
                                                    )
                                                    : null
                                            )
                                    ),
                                    validate: static fn (string $value) => (
                                        V::create()
                                            ->notEmpty()
                                            ->invoiceRoutingIdentifier($country)
                                            ->diagnose($value)
                                    ),
                                );
                                return $country->normalizeInvoiceRoutingIdentifier($rawValue);
                            },
                            name: 'routingIdentifier',
                        )
                        // - Délai de paiement par défaut.
                        ->select(
                            name: 'paymentTermDaysChoice',
                            label: $__('fields.invoices.payment-term-days.label'),
                            hint: $__('fields.invoices.payment-term-days.hint'),
                            options: Arr::mapWithKeys(
                                $predefinedTermDays,
                                static function (string $days) use ($__) {
                                    $label = (
                                        $days === '0'
                                            ? $__('fields.invoices.payment-term-days.options.on-receipt')
                                            : $__('fields.invoices.payment-term-days.options.days', $days)
                                    );
                                    return [$days => $label];
                                },
                            ) + ['__CUSTOM__' => $__('fields.invoices.payment-term-days.options.custom')],
                            required: $__('global.mandatory-field'),
                            default: $defaultTermDaysChoice,
                        )
                        // - Délai de paiement personnalisé.
                        ->addIf(
                            static fn (array $subResponses) => (
                                $subResponses['paymentTermDaysChoice'] === '__CUSTOM__'
                            ),
                            // phpcs:ignore Generic.Files.LineLength.TooLong
                            static fn (array $subResponses, string|null $previousResponse) => (
                                text(
                                    label: $__('fields.invoices.payment-term-days.custom-label'),
                                    required: $__('global.mandatory-field'),
                                    default: $previousResponse ?? $defaultTermDaysCustom,
                                    validate: static fn (string $value) => (
                                        V::create()
                                            ->intVal()
                                            ->between(0, 365)
                                            ->diagnose($value)
                                    ),
                                )
                            ),
                            name: 'paymentTermDaysCustom',
                        )
                        // - Moyens de paiement acceptés.
                        ->multiselect(
                            name: 'paymentMethods',
                            label: $__('fields.invoices.payment-methods.label'),
                            hint: $__('fields.invoices.payment-methods.hint'),
                            options: [
                                PaymentMethod::CASH->value => (
                                    $__('fields.invoices.payment-methods.options.cash')
                                ),
                                PaymentMethod::CARD->value => (
                                    $__('fields.invoices.payment-methods.options.card')
                                ),
                                PaymentMethod::CHEQUE->value => (
                                    $__('fields.invoices.payment-methods.options.cheque')
                                ),
                                PaymentMethod::TRANSFER->value => (
                                    $__('fields.invoices.payment-methods.options.transfer.label')
                                ),
                            ],
                            default: array_keys(array_filter($currentPaymentMethods)),
                        )
                        // - IBAN (pour le paiement par virement).
                        ->addIf(
                            static fn (array $subResponses) => (
                                in_array(PaymentMethod::TRANSFER->value, $subResponses['paymentMethods'], true)
                            ),
                            static fn (array $subResponses, string|null $previousResponse) => (
                                 text(
                                     label: $__('fields.invoices.payment-methods.options.transfer.details.iban'),
                                     required: $__('global.mandatory-field'),
                                     default: (
                                        $previousResponse
                                            ?? (string) Arr::get($currentPaymentMethods, 'transfer.iban')
                                     ),
                                     transform: static fn (string $value) => trim($value),
                                     validate: static fn (string $value) => (
                                        V::notEmpty()->iban()->diagnose($value)
                                     ),
                                 )
                            ),
                            name: 'paymentMethods.transfer.iban',
                        )
                        // - BIC / SWIFT (pour le paiement par virement).
                        ->addIf(
                            static fn (array $subResponses) => (
                                in_array(PaymentMethod::TRANSFER->value, $subResponses['paymentMethods'], true)
                            ),
                            // phpcs:ignore Generic.Files.LineLength.TooLong
                            static function (array $subResponses, string|null $previousResponse) use ($__, $currentPaymentMethods) {
                                $rawValue = text(
                                    label: $__('fields.invoices.payment-methods.options.transfer.details.bic'),
                                    default: (
                                        $previousResponse
                                            ?? (string) Arr::get($currentPaymentMethods, 'transfer.bic')
                                    ),
                                    transform: static fn (string $value) => trim($value),
                                    validate: static fn (string $value) => (
                                        V::length(null, 100)->diagnose($value)
                                    ),
                                );
                                return !empty($rawValue) ? $rawValue : null;
                            },
                            name: 'paymentMethods.transfer.bic',
                        )
                        // - Nom du titulaire du compte (pour le paiement par virement).
                        ->addIf(
                            static fn (array $subResponses) => (
                                in_array(PaymentMethod::TRANSFER->value, $subResponses['paymentMethods'], true)
                            ),
                            // phpcs:ignore Generic.Files.LineLength.TooLong
                            static function (array $subResponses, string|null $previousResponse) use ($__, $currentPaymentMethods) {
                                $rawValue = text(
                                    label: $__('fields.invoices.payment-methods.options.transfer.details.holder.label'),
                                    hint: $__('fields.invoices.payment-methods.options.transfer.details.holder.hint'),
                                    default: (
                                        $previousResponse
                                            ?? (string) Arr::get($currentPaymentMethods, 'transfer.holder')
                                    ),
                                    transform: static fn (string $value) => trim($value),
                                    validate: static fn (string $value) => (
                                        V::length(null, 100)->diagnose($value)
                                    ),
                                );
                                return !empty($rawValue) ? $rawValue : null;
                            },
                            name: 'paymentMethods.transfer.holder',
                        )
                        ->submit();

                    // - Délai de paiement "final".
                    $paymentTermDays = $data['paymentTermDaysChoice'] !== '__CUSTOM__'
                        ? (int) $data['paymentTermDaysChoice']
                        : (int) $data['paymentTermDaysCustom'];

                    $paymentMethods = [];
                    foreach (PaymentMethod::cases() as $method) {
                        if (!in_array($method->value, $data['paymentMethods'], true)) {
                            $paymentMethods[$method->value] = false;
                            continue;
                        }

                        if ($method !== PaymentMethod::TRANSFER) {
                            $paymentMethods[$method->value] = true;
                            continue;
                        }

                        $details = ['iban' => $data['paymentMethods.transfer.iban']];
                        if (!empty($data['paymentMethods.transfer.bic'] ?? null)) {
                            $details['bic'] = $data['paymentMethods.transfer.bic'];
                        }
                        if (!empty($data['paymentMethods.transfer.holder'] ?? null)) {
                            $details['holder'] = $data['paymentMethods.transfer.holder'];
                        }
                        $paymentMethods[$method->value] = $details;
                    }

                    return [
                        'routingIdentifier' => $data['routingIdentifier'],
                        'paymentTermDays' => $paymentTermDays,
                        'paymentMethods' => $paymentMethods,
                    ];
                },
                name: 'invoices',
            )

            //
            // - Paramètres de l'application.
            //

            ->add(
                static fn () => $heading($__('headings.application-parameters'), inForm: true),
                name: '__heading',
            )

            // - Politique de retour des événements et réservations.
            ->add(
                static function (array $responses, ReturnPolicy|null $previousResponse) use ($__, $getSavedValue) {
                    $rawValue = select(
                        label: $__('fields.return-policy.label'),
                        hint: $__('fields.return-policy.hint'),
                        options: [
                            ReturnPolicy::AUTO->value => $__('fields.return-policy.options.auto'),
                            ReturnPolicy::MANUAL->value => $__('fields.return-policy.options.manual'),
                        ],
                        required: $__('global.mandatory-field'),
                        default: (
                            $previousResponse?->value
                                ?? (string) $getSavedValue('returnPolicy')?->value
                        ),
                    );
                    return ReturnPolicy::from($rawValue);
                },
                name: 'returnPolicy',
            )

            ->add(
                static fn () => confirm(
                    label: $__('should-configure-advanced'),
                    default: false,
                    yes: $__('global.yes'),
                    no: $__('global.no'),
                ),
                name: 'shouldConfigureAdvanced',
            )

            // - Jeton de sécurité JWT.
            ->addIf(...$whenAdvanced(
                name: 'JWTSecret',
                field: static fn (string|null $previousResponse) => (
                    text(
                        label: $__('fields.jwt-secret.label'),
                        hint: $__('fields.jwt-secret.hint'),
                        required: $__('global.mandatory-field'),
                        default: $previousResponse ?? (string) $defaultSecretToken,
                        validate: static fn (string $value) => (
                            V::create()
                                ->notEmpty()
                                ->alnum()
                                ->length(12)
                                ->diagnose($value)
                        ),
                    )
                ),
                condition: static fn () => !$isUpdate,
            ))

            // - Activation des CORS ?
            ->addIf(...$whenAdvanced(
                name: 'enableCORS',
                field: static fn (bool|null $previousResponse) => (
                    confirm(
                        label: $__('fields.enable-cors.label'),
                        default: $previousResponse ?? (bool) $getSavedValue('enableCORS'),
                        yes: $__('global.yes'),
                        no: $__('global.no'),
                        hint: $__('fields.enable-cors.hint'),
                    )
                ),
            ))

            // - Durée d'expiration des sessions
            ->addIf(...$whenAdvanced(
                name: 'sessionExpireHours',
                field: static fn (string|null $previousResponse) => (
                    text(
                        label: $__('fields.session-expire-hours.label'),
                        hint: $__('fields.session-expire-hours.hint'),
                        required: $__('global.mandatory-field'),
                        default: $previousResponse ?? (string) $getSavedValue('sessionExpireHours'),
                        validate: static fn (string $value) => (
                            V::create()
                                ->intVal()
                                ->between(1, 30 * 24)
                                ->diagnose($value)
                        ),
                    )
                ),
            ))

            // - Nombre maximum d'éléments par page de listing.
            ->addIf(...$whenAdvanced(
                name: 'maxItemsPerPage',
                field: static fn (string|null $previousResponse) => (
                    text(
                        label: $__('fields.max-items-per-page.label'),
                        hint: $__('fields.max-items-per-page.hint'),
                        required: $__('global.mandatory-field'),
                        default: $previousResponse ?? (string) $getSavedValue('maxItemsPerPage'),
                        validate: static fn (string $value) => (
                            V::create()
                                ->intVal()
                                ->between(10, 250)
                                ->diagnose($value)
                        ),
                    )
                ),
            ));

        $responses = array_filter(
            $form->submit(),
            static fn (string $key) => (
                !($unspecifiedFields[$key] ?? false)
            ),
            \ARRAY_FILTER_USE_KEY,
        );

        unset(
            $responses['shouldConfigureAdvanced'],
            $responses['__changeWizardLanguage'],
            $responses['__heading'],
        );

        // - Vu qu'on ne redemande pas le JWT Secret s'il existait déjà
        //   dans la config., on le met manuellement.
        $responses['JWTSecret'] ??= $defaultSecretToken;

        // - Champs qui doivent être des integers.
        foreach (['sessionExpireHours', 'maxItemsPerPage'] as $intField) {
            if (($responses[$intField] ?? null) !== null) {
                $responses[$intField] = (int) $responses[$intField];
            }
        }

        // - Normalisation et sauvegarde de la configuration.
        $settings = array_replace_recursive($savedConfig, $responses);

        $sort = static function (array &$data, array $ref) use (&$sort) {
            $positions = array_flip(array_keys($ref));
            uksort($data, static function ($a, $b) use ($positions) {
                $posA = $positions[$a] ?? PHP_INT_MAX;
                $posB = $positions[$b] ?? PHP_INT_MAX;
                return $posA <=> $posB;
            });

            foreach ($data as $key => &$value) {
                if (is_array($value) && isset($ref[$key]) && is_array($ref[$key])) {
                    $sort($value, $ref[$key]);
                }
            }
        };
        $sort($settings, Config::getDefault());
        Config::saveCustomConfig($settings);
        Kernel::reset();
        $output->writeln(sprintf("<info>✓ %s</info>\n", $__('statuses.settings-saved')));

        //
        // - Migration de la base de données.
        //

        $heading($__('headings.database-update'));
        pause($__('database-updated-continue'));
        try {
            spin(
                callback: fn () => $this->executeMigrations(),
                message: $__('statuses.updating-database'),
            );
            $output->writeln(sprintf("<info>✓ %s</info>\n", $__('statuses.database-updated')));
        } catch (\RuntimeException $e) {
            $output->writeln(vsprintf("\n<error>%s</error>\n\n<fg=red>%s</>", [
                $__('errors.database-update'),
                $e->getMessage(),
            ]));
            return Command::FAILURE;
        }

        //
        // - Création du premier administrateur.
        //

        $hasAdmin = User::where('group', Group::ADMINISTRATION)->exists();
        if (!$hasAdmin) {
            $heading($__('headings.administrator-creation.title'));
            $output->writeln(sprintf("\n<fg=cyan>%s</>", $__('headings.administrator-creation.details')));

            $doPrompt = static fn ($previousResponses) => (
                form()
                    ->text(
                        name: 'person.first_name',
                        label: $__('fields.administrator.fields.first-name'),
                        required: $__('global.mandatory-field'),
                        default: $previousResponses['person']['first_name'] ?? '',
                        validate: static fn (string $value) => (
                            V::create()
                                ->notEmpty()
                                ->nameLike()
                                ->length(2, 35)
                                ->diagnose($value)
                        ),
                    )
                    ->text(
                        name: 'person.last_name',
                        label: $__('fields.administrator.fields.last-name'),
                        required: $__('global.mandatory-field'),
                        default: $previousResponses['person']['last_name'] ?? '',
                        validate: static fn (string $value) => (
                            V::create()
                                ->notEmpty()
                                ->nameLike()
                                ->length(2, 35)
                                ->diagnose($value)
                        ),
                    )
                    ->add(
                        static function (array $responses, string|null $previousResponse) use ($__) {
                            $defaultValue = $previousResponse;
                            if ($defaultValue === null) {
                                $defaultValue = User::createPseudoFromName(
                                    $responses['person.first_name'],
                                    $responses['person.last_name'],
                                );
                            }

                            return text(
                                label: $__('fields.administrator.fields.pseudo.label'),
                                hint: $__('fields.administrator.fields.pseudo.hint'),
                                required: $__('global.mandatory-field'),
                                default: $defaultValue,
                                validate: static function (string $value) use ($__) {
                                    $diagnostic = V::create()
                                        ->alnum('-', '_', '.')
                                        ->length(4, 100)
                                        ->diagnose($value);

                                    if ($diagnostic !== null) {
                                        return $diagnostic;
                                    }

                                    $alreadyExists = User::query()
                                        ->where('pseudo', $value)
                                        ->withTrashed()
                                        ->exists();

                                    return $alreadyExists
                                        ? $__('global.user-pseudo-already-in-use')
                                        : null;
                                },
                            );
                        },
                        name: 'pseudo',
                    )
                    ->password(
                        name: 'password',
                        label: $__('fields.administrator.fields.password.label'),
                        hint: $__('fields.administrator.fields.password.hint'),
                        required: $__('global.mandatory-field'),
                        validate: static fn (string $value) => (
                            V::create()
                                ->notEmpty()
                                ->length(4, 191)
                                ->diagnose($value)
                        ),
                    )
                    ->text(
                        name: 'email',
                        label: $__('fields.administrator.fields.email.label'),
                        hint: $__('fields.administrator.fields.email.hint'),
                        required: $__('global.mandatory-field'),
                        default: $previousResponses['email'] ?? '',
                        placeholder: $__('fields.administrator.fields.email.placeholder'),
                        validate: static function (string $value) use ($__) {
                            $diagnostic = V::create()
                                ->notEmpty()
                                ->email()
                                ->length(5, 191)
                                ->diagnose($value);

                            if ($diagnostic !== null) {
                                return $diagnostic;
                            }

                            $alreadyExists = User::query()
                                ->where('email', $value)
                                ->withTrashed()
                                ->exists();

                            return $alreadyExists
                                ? $__('global.email-already-in-use')
                                : null;
                        },
                    )
                    ->submit()
            );
            while (1 === 1) {
                $userData = array_replace(
                    Arr::undot($doPrompt($userData ?? [])),
                    ['group' => Group::ADMINISTRATION],
                );

                try {
                    User::new($userData);
                    break;
                } catch (ValidationException) {
                    error($__('fields.administrator.errors.validation'));
                }
            }
        }

        $output->writeln(vsprintf("\n<fg=black;bg=green> %s </> %s", [
            $__('statuses.installation-completed'),
            sprintf('<href=%1$s>%1$s</>', Config::getBaseUrl()),
        ]));
        return Command::SUCCESS;
    }

    // ------------------------------------------------------
    // -
    // -    Méthodes internes
    // -
    // ------------------------------------------------------

    protected function renderIntro(OutputInterface $output): void
    {
        $__ = $this->translateFactory();

        $title = $__('installation-wizard');
        $version = sprintf("%s (Premium)", (
            Str::chopEnd(Config::getVersion(), '-premium')
        ));

        $terminalSize = (new Terminal())->getWidth();
        $terminalSizeEven = $terminalSize % 2 !== 0
            ? $terminalSize - 1
            : $terminalSize;

        $headerArt = [
            '██╗      ██████╗ ██╗  ██╗██╗   ██╗ █████╗',
            '██║     ██╔═══██╗╚██╗██╔╝╚██╗ ██╔╝██╔══██╗',
            '██║     ██║   ██║ ╚███╔╝  ╚████╔╝ ███████║',
            '██║     ██║   ██║ ██╔██╗   ╚██╔╝  ██╔══██║',
            '███████╗╚██████╔╝██╔╝ ██╗   ██║   ██║  ██║',
            '╚══════╝ ╚═════╝ ╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═╝',
        ];
        $headerArtLength = max(array_map('mb_strlen', $headerArt));
        if ($terminalSize > $headerArtLength) {
            $headerUseColumns = min($terminalSizeEven, 64);

            $header = implode("\n", array_map(
                static fn ($line) => (
                    // - "Centre" le message dans l'espace voulu.
                    Str::padBoth($line, $headerUseColumns)
                ),
                [
                    ...$headerArt,
                    // - Aligne la version à la droite du ASCII Art "Loxya".
                    Str::padLeft($version, $headerArtLength) . "\n",
                    sprintf("- %s -", $title),
                ],
            ));

            $output->writeln(sprintf("<fg=cyan>\n%s\n</>", $header));
            return;
        }

        $headerParts = [sprintf("Loxya %s", $version), $title];
        $headerMinLength = max(array_map('mb_strlen', $headerParts));
        $headerUseLength = max($headerMinLength, $terminalSizeEven);

        $header = implode("\n", array_map(
            static fn ($line) => (
                sprintf(
                    "<fg=black;bg=cyan>%s</>",
                    // - "Centre" le message dans l'espace voulu.
                    Str::padBoth($line, $headerUseLength),
                )
            ),
            $headerParts,
        ));

        $output->writeln(sprintf("\n%s", $header));
    }

    protected function executeMigrations(): void
    {
        // - Permet l'exécution des longues migrations.
        set_time_limit(3600);

        $command = (new CliApp())->find('migrations:migrate');

        $args = new ArrayInput([]);
        $args->setInteractive(false);

        $buffer = new BufferedOutput();
        $exitCode = $command->run($args, $buffer);

        if (!in_array($exitCode, [0, 3], true)) {
            throw new \RuntimeException($buffer->fetch(), $exitCode);
        }
    }

    private static function getSavedConfig(): array
    {
        if (!Config::customConfigExists()) {
            return [];
        }

        $config = array_replace(Config::getCustomConfig(), [
            'baseUrl' => Config::getBaseUrl(),
        ]);

        // - Rétro-compatibilité: `'currency' => ['iso' => '...']`.
        if (is_array($config['currency'] ?? null)) {
            $config['currency'] = $config['currency']['iso']
                ?? Config::getDefault('currency');
        }

        // - Rétro-compatibilité: `'companyData' => ['country' => 'France']`.
        $rawCountry = Arr::get($config, 'companyData.country');
        $hasLegacyCountry = (
            !empty($rawCountry) &&
            (
                strlen($rawCountry) !== 2 ||
                strtoupper($rawCountry) !== $rawCountry
            )
        );
        if ($hasLegacyCountry) {
            $config['companyData']['country'] = Country::tryFrom($rawCountry)?->getCode();
        }

        // - Rétro-compatibilité: `'companyData' => ['zipCode']` => `'postalCode'`.
        if (Arr::has($config, 'companyData.zipCode')) {
            $config['companyData']['postalCode'] = Arr::get($config, 'companyData.zipCode');
            unset($config['companyData']['zipCode']);
        }

        // - Rétro-compatibilité: `'companyData' => ['street']` => `'street[0]'`.
        if (Arr::has($config, 'companyData.street')) {
            $config['companyData']['street'] = [Arr::get($config, 'companyData.street')];
        }

        // - Rétro-compatibilité: `'companyData' => ['legalNumbers' => ['name' => '...', 'value' => '...]]`
        $rawLegalNumbers = Arr::pull($config, 'companyData.legalNumbers');
        if ($rawLegalNumbers !== null && is_array($rawLegalNumbers)) {
            $legalNumbers = (new Collection($rawLegalNumbers))
                ->filter(static fn ($item) => isset($item['name'], $item['value']))
                ->mapWithKeys(static fn ($item) => [strtoupper($item['name']) => $item['value']])
                ->all();

            $migrationMatrix = [
                'FR' => [
                    'SIRET' => 'registrationId',
                    'APE' => 'activityCode',
                ],
                'BE' => [
                    'BCE' => 'registrationId',
                    'NACE' => 'activityCode',
                ],
                'CH' => [
                    'IDE' => 'registrationId',
                    'NOGA' => 'activityCode',
                ],
            ];
            foreach ($migrationMatrix as $country => $migrations) {
                if (!in_array($config['companyData']['country'], [$country, null], true)) {
                    continue;
                }

                foreach ($migrations as $legacyName => $configKey) {
                    if (!empty($config['companyData'][$configKey]) || empty($legalNumbers[$legacyName])) {
                        continue;
                    }
                    $config['companyData'][$configKey] = $legalNumbers[$legacyName];
                }
            }
        }

        // - Rétro-compatibilité: `'companyData'` => `'organization'`.
        if (array_key_exists('companyData', $config)) {
            $config['organization'] = array_replace(
                $config['organization'] ?? [],
                $config['companyData'],
            );
            unset($config['companyData']);
        }

        // - Rétro-compatibilité: `'legacy' => ['companyData']` => `'legacy' => ['organization']`.
        if (Arr::has($config, 'legacy.companyData')) {
            Arr::set($config, 'legacy.organization', Arr::pull($config, 'legacy.companyData'));
        }

        // - Rétro-compatibilité: Pays d'utilisation principal.
        $organizationCountry = Arr::get($config, 'organization.country');
        if (empty($config['mainCountry']) && $organizationCountry !== null) {
            $config['mainCountry'] = $organizationCountry;
        }

        // - Rétro-compatibilité: Champs supprimés.
        Arr::forget($config, [
            'httpAuthHeader',
            'db.options',
            'db.charset',
            'db.collation',
        ]);

        // - Données legacy.
        $legacyData = [
            'defaultTags',
            'organization.vatRate',
            'degressiveRateFunction',
        ];
        foreach ($legacyData as $legacyField) {
            if (!Arr::has($config, $legacyField)) {
                continue;
            }

            Arr::set(
                $config,
                sprintf('legacy.%s', $legacyField),
                Arr::pull($config, $legacyField),
            );
        }

        return $config;
    }

    private function getAllCurrencies(): array
    {
        $lang = $this->i18n->getLanguage();

        // @phpstan-ignore-next-line include.fileNotFound
        static::$rawCurrencies ??= require MIGRATIONS_FOLDER . DS . 'data' . DS . 'currencies.php';

        $currencies = [];
        foreach (static::$rawCurrencies as $rawCurrency) {
            $currencies[$rawCurrency['code']] = (
                $rawCurrency['name'][$lang]
                    ?? $rawCurrency['name']['en']
            );
        }

        return $currencies;
    }

    private function getAllCountries(): array
    {
        $lang = $this->i18n->getLanguage();

        $countries = [];
        foreach (Country::all() as $country) {
            $countries[$country->getCode()] = $country->getName($lang);
        }

        return $countries;
    }

    private function translateFactory(?I18n $i18n = null): callable
    {
        return function (string|array $key, ...$others) use ($i18n) {
            $keys = array_map(
                static fn (string $key) => (
                    !str_starts_with($key, 'global.')
                        ? sprintf('console.commands.install.%s', $key)
                        : Str::replaceStart('global.', '', $key)
                ),
                !is_array($key) ? [$key] : $key,
            );
            return ($i18n ?? $this->i18n)->translate($keys, ...$others);
        };
    }
}
