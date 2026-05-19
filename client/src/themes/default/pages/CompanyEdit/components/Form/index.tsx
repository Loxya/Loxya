import './index.scss';
import pick from 'lodash/pick';
import { defineComponent } from 'vue';
import cloneDeep from 'lodash/cloneDeep';
import { AddressField } from '@/utils/address';
import config, { BillingMode } from '@/globals/config';
import Button from '@/themes/default/components/Button';
import Fieldset from '@/themes/default/components/Fieldset';
import FormField from '@/themes/default/components/FormField';
import { VerticalFormKey } from '@/themes/default/components/@constants';
import SelectCountry from '@/themes/default/components/SelectCountry';

import type Country from '@/utils/country';
import type { ComponentRef, PropType } from 'vue';
import type { AddressFieldDefinition } from '@/utils/country';
import type { Company, CompanyEdit } from '@/stores/api/companies';

type Props = {
    /** Les données déjà sauvegardées de la société (s'il existait déjà). */
    savedData?: Company | null,

    /** Permet d'indiquer que la sauvegarde est en cours. */
    isSaving?: boolean,

    /** Liste des erreurs de validation éventuelles. */
    errors?: Partial<Record<keyof CompanyEdit, string>> | null,

    /**
     * Fonction appelée lorsque l'utilisateur soumet les changements.
     *
     * @param data - Les données soumises.
     */
    onSubmit?(data: CompanyEdit): void,

    /**
     * Fonction appelée lorsque l'utilisateur manifeste
     * son souhait d'annuler l'edition.
     */
    onCancel?(): void,
};

type Data = {
    data: CompanyEdit,
    usesCustomInvoiceIdentifier: boolean,
};

const getDefaults = (savedData: Company | null, requestedLegalName: string | undefined): CompanyEdit => {
    const BASE_DEFAULTS: CompanyEdit = {
        legal_name: requestedLegalName ?? null,
        is_public_entity: false,
        registration_id: null,
        vat_number: null,
        service_code: null,
        invoice_identifier: null,
        phone: null,
        street: null,
        additional_street: null,
        postal_code: null,
        administrative_area: null,
        locality: null,
        country: config.mainCountry,
        note: null,
    };

    const data = {
        ...BASE_DEFAULTS,
        ...pick(savedData ?? {}, Object.keys(BASE_DEFAULTS)),
        country: savedData?.country ?? config.mainCountry,
    };

    if ((savedData?.phone ?? null) !== null) {
        const shouldUseInternationalFormat = (
            !data.country.isSame(config.mainCountry) ||
            !savedData!.phone!.country?.isSame(config.mainCountry)
        );
        data.phone = shouldUseInternationalFormat
            ? savedData!.phone!.formatInternational()
            : savedData!.phone!.formatNational();
    }

    return data;
};

/** Formulaire d'édition d'une société. */
const CompanyEditForm = defineComponent({
    name: 'CompanyEditForm',
    provide: {
        [VerticalFormKey as symbol]: true,
    },
    props: {
        savedData: {
            type: Object as PropType<Required<Props>['savedData']>,
            default: null,
        },
        isSaving: {
            type: Boolean as PropType<Required<Props>['isSaving']>,
            default: false,
        },
        errors: {
            type: Object as PropType<Required<Props>['errors']>,
            default: null,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onSubmit: {
            type: Function as PropType<Props['onSubmit']>,
            default: undefined,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onCancel: {
            type: Function as PropType<Props['onCancel']>,
            default: undefined,
        },
    },
    emits: ['submit', 'cancel'],
    data(): Data {
        const data = getDefaults(this.savedData, (() => {
            const rawRequestedName = this.$route.query.name ?? undefined;
            if (rawRequestedName === undefined || typeof rawRequestedName !== 'string') {
                return undefined;
            }
            return rawRequestedName;
        })());

        // - Si l'identifiant est personnalisé, on affiche le champ
        //   de customisation de l'identifiant e-facturation.
        const usesCustomInvoiceIdentifier = data.invoice_identifier !== null;

        return { data, usesCustomInvoiceIdentifier };
    },
    computed: {
        isLegalNameFilled(): boolean {
            return this.data.legal_name !== '';
        },

        addressFields(): AddressFieldDefinition[][] {
            return this.data.country.getAddressFields(true);
        },

        isBillingEnabled(): boolean {
            return config.billingMode !== BillingMode.NONE;
        },

        isAddressRequired(): boolean {
            // - Si la facturation est désactivée, on ne rend pas le champ obligatoire.
            if (!this.isBillingEnabled) {
                return false;
            }

            const sellerCountry = config.organization.country;
            return sellerCountry.requireBuyerAddress(true);
        },

        isRegistrationIdRequired(): boolean {
            if (!this.isBillingEnabled) {
                return false;
            }

            const sellerCountry = config.organization.country;
            return sellerCountry.requireBuyerRegistrationId(this.data.country);
        },

        useElectronicInvoices(): boolean {
            if (!this.isBillingEnabled) {
                return false;
            }

            const sellerCountry = config.organization.country;
            return sellerCountry.useElectronicInvoices;
        },

        showInvoiceIdentifierFields(): boolean {
            if (!this.isBillingEnabled || !this.useElectronicInvoices) {
                return false;
            }

            // TODO: Permettre le remplissage de ce champ pour les sociétés étrangères quand Peppol est utilisé.
            //       (validation de l'identifiant à retravailler côté back-end en même temps)
            const sellerCountry = config.organization.country;
            return sellerCountry.isSame(this.data.country, true);
        },

        canInferDefaultInvoiceIdentifier(): boolean {
            const buyerCountry = this.data.country;
            return buyerCountry.canInferDefaultInvoiceRoutingIdentifier;
        },

        inferredInvoiceIdentifier(): string | null {
            const registrationId = this.data.registration_id;
            if (!this.canInferDefaultInvoiceIdentifier || registrationId === null) {
                return null;
            }

            const buyerCountry = this.data.country;
            return buyerCountry.inferDefaultInvoiceRoutingIdentifier(registrationId);
        },
    },
    mounted() {
        if (!this.isLegalNameFilled) {
            this.$nextTick(() => {
                const $inputLegalName = this.$refs.inputLegalName as ComponentRef<typeof FormField>;
                $inputLegalName?.focus();
            });
        }
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleChangeCountry(newCountry: Country) {
            const wasSameInheritedCountry = newCountry.isSame(this.data.country, true);
            this.data.country = newCountry;

            // - On reset l'identifiant e-invoicing si le pays change.
            if (!wasSameInheritedCountry) {
                this.data.invoice_identifier = null;
                this.usesCustomInvoiceIdentifier = false;
            }

            const fieldMap = {
                [AddressField.ADDRESS_LINE1]: 'street',
                [AddressField.ADDRESS_LINE2]: 'additional_street',
                [AddressField.POSTAL_CODE]: 'postal_code',
                [AddressField.ADMINISTRATIVE_AREA]: 'administrative_area',
                [AddressField.LOCALITY]: 'locality',
            } as const;
            const newAddressFields = newCountry.getUsedAddressField();
            Object.entries(fieldMap).forEach(([field, dataKey]) => {
                if (!newAddressFields.includes(field as AddressField)) {
                    this.data[dataKey] = null;
                }
            });
        },

        handleChangeCustomizeInvoiceRoutingIdentifier(usesCustomIdentifier: boolean) {
            this.usesCustomInvoiceIdentifier = usesCustomIdentifier;

            if (!usesCustomIdentifier) {
                this.data.invoice_identifier = null;
            }
        },

        handleSubmit(e: SubmitEvent) {
            e?.preventDefault();

            this.$emit('submit', cloneDeep(this.data));
        },

        handleCancel() {
            this.$emit('cancel');
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        __(key: string, params?: Record<string, number | string> | string, count?: number): string {
            key = !key.startsWith('global.')
                ? `page.company-edit.${key}`
                : key.replace(/^global\./, '');

            return this.$t(key, params as Record<string, number | string>, count);
        },
    },
    render() {
        const {
            __,
            data,
            errors,
            addressFields,
            isSaving,
            isBillingEnabled,
            isAddressRequired,
            isRegistrationIdRequired,
            usesCustomInvoiceIdentifier,
            showInvoiceIdentifierFields,
            canInferDefaultInvoiceIdentifier,
            inferredInvoiceIdentifier,
            handleSubmit,
            handleCancel,
            handleChangeCountry,
            handleChangeCustomizeInvoiceRoutingIdentifier,
        } = this;

        return (
            <form
                class="Form Form--fixed-actions CompanyEditForm"
                onSubmit={handleSubmit}
            >
                <Fieldset>
                    <div class="CompanyEditForm__legal-name">
                        <FormField
                            ref="inputLegalName"
                            label={__('global.legal-name')}
                            autocomplete="off"
                            value={data.legal_name}
                            error={errors?.legal_name}
                            onInput={(value: string) => {
                                data.legal_name = value;
                            }}
                            required
                        />
                        <FormField
                            type="switch"
                            label={__('is-public-entity')}
                            class="CompanyEditForm__is-public-entity"
                            value={data.is_public_entity}
                            onChange={(value: boolean) => {
                                data.is_public_entity = value;

                                if (!value) {
                                    data.service_code = null;
                                }
                            }}
                            required
                        />
                    </div>
                    <div class="CompanyEditForm__legal-numbers">
                        <FormField
                            label={(() => {
                                // - Pour une entité publique, on exige un identifiant précis (ex. SIRET en France).
                                if (this.data.is_public_entity) {
                                    const label: string = __(`global.precise-registration-id.${data.country.code}`, '');
                                    return label !== '' ? label : __('global.precise-registration-id.generic');
                                }
                                const label: string = __(`global.registration-id.${data.country.code}`, '');
                                return label !== '' ? label : __('global.registration-id.generic');
                            })()}
                            class="CompanyEditForm__registration-id"
                            autocomplete="off"
                            value={data.registration_id}
                            error={errors?.registration_id}
                            required={isRegistrationIdRequired}
                            onInput={(value: string) => {
                                data.registration_id = value;
                            }}
                        />
                        <FormField
                            label={(() => {
                                let label: string | null;
                                label = __(`global.vat-number.${data.country.code}`, '');
                                label = label !== '' ? label : null;
                                return label ?? __('global.vat-number.generic');
                            })()}
                            class="CompanyEditForm__vat-number"
                            autocomplete="off"
                            value={data.vat_number}
                            error={errors?.vat_number}
                            onInput={(value: string) => {
                                data.vat_number = value;
                            }}
                        />
                        {data.is_public_entity && (
                            <FormField
                                label={__('service-code')}
                                class="CompanyEditForm__service-code"
                                autocomplete="off"
                                value={data.service_code}
                                error={errors?.service_code}
                                onInput={(value: string) => {
                                    data.service_code = value;
                                }}
                            />
                        )}
                    </div>
                    <FormField
                        label={__('global.phone')}
                        type="tel"
                        autocomplete="off"
                        value={data.phone}
                        error={errors?.phone}
                        onInput={(value: string) => {
                            data.phone = value;
                        }}
                    />
                </Fieldset>
                <Fieldset title={__('global.address')}>
                    <div class="CompanyEditForm__address">
                        {addressFields.map((lineFields: AddressFieldDefinition[], index: number) => (
                            <div key={index} class="CompanyEditForm__address__group">
                                {lineFields.map((field: AddressFieldDefinition) => {
                                    switch (field.field) {
                                        case AddressField.ADDRESS_LINE1: {
                                            return (
                                                <FormField
                                                    label={__('global.street')}
                                                    class={[
                                                        'CompanyEditForm__address__part',
                                                        `CompanyEditForm__address__part--street`,
                                                    ]}
                                                    autocomplete="off"
                                                    value={data.street}
                                                    error={errors?.street}
                                                    required={isAddressRequired && field.required}
                                                    onInput={(value: string) => {
                                                        data.street = value;
                                                    }}
                                                />
                                            );
                                        }
                                        case AddressField.ADDRESS_LINE2: {
                                            return (
                                                <FormField
                                                    label={__('global.additional-street')}
                                                    class={[
                                                        'CompanyEditForm__address__part',
                                                        `CompanyEditForm__address__part--additional-street`,
                                                    ]}
                                                    autocomplete="off"
                                                    value={data.additional_street}
                                                    error={errors?.additional_street}
                                                    required={isAddressRequired && field.required}
                                                    onInput={(value: string) => {
                                                        data.additional_street = value;
                                                    }}
                                                />
                                            );
                                        }
                                        case AddressField.POSTAL_CODE: {
                                            return (
                                                <FormField
                                                    label={__(`global.postal-code.${field.type}`)}
                                                    class={[
                                                        'CompanyEditForm__address__part',
                                                        'CompanyEditForm__address__part--postal-code',
                                                    ]}
                                                    autocomplete="off"
                                                    value={data.postal_code}
                                                    error={errors?.postal_code}
                                                    required={isAddressRequired && field.required}
                                                    onInput={(value: string) => {
                                                        data.postal_code = value;
                                                    }}
                                                />
                                            );
                                        }
                                        case AddressField.ADMINISTRATIVE_AREA: {
                                            return (
                                                <FormField
                                                    label={__(`global.administrative-area.${field.type}`)}
                                                    class={[
                                                        'CompanyEditForm__address__part',
                                                        'CompanyEditForm__address__part--administrative-area',
                                                    ]}
                                                    autocomplete="off"
                                                    value={data.administrative_area}
                                                    error={errors?.administrative_area}
                                                    required={isAddressRequired && field.required}
                                                    onInput={(value: string) => {
                                                        data.administrative_area = value;
                                                    }}
                                                />
                                            );
                                        }
                                        case AddressField.LOCALITY: {
                                            return (
                                                <FormField
                                                    label={__(`global.locality.${field.type}`)}
                                                    class={[
                                                        'CompanyEditForm__address__part',
                                                        'CompanyEditForm__address__part--locality',
                                                    ]}
                                                    autocomplete="off"
                                                    value={data.locality}
                                                    error={errors?.locality}
                                                    required={isAddressRequired && field.required}
                                                    onInput={(value: string) => {
                                                        data.locality = value;
                                                    }}
                                                />
                                            );
                                        }
                                        default: {
                                            return null;
                                        }
                                    }
                                })}
                            </div>
                        ))}
                    </div>
                    <FormField
                        type="custom"
                        label={__('global.country')}
                        error={errors?.country}
                    >
                        <SelectCountry
                            placeholder={false}
                            value={data.country}
                            onChange={handleChangeCountry}
                        />
                    </FormField>
                </Fieldset>
                {(isBillingEnabled && showInvoiceIdentifierFields) && (
                    <Fieldset title={__('global.billing-infos')}>
                        {canInferDefaultInvoiceIdentifier && (
                            <FormField
                                type="switch"
                                label={__('invoice-routing-identifier-customize.label')}
                                help={(
                                    !usesCustomInvoiceIdentifier
                                        ? __('invoice-routing-identifier-customize.help')
                                        : undefined
                                )}
                                value={usesCustomInvoiceIdentifier}
                                onChange={handleChangeCustomizeInvoiceRoutingIdentifier}
                            />
                        )}
                        {(!canInferDefaultInvoiceIdentifier || usesCustomInvoiceIdentifier) && (
                            <FormField
                                label={__('invoice-routing-identifier.label')}
                                help={__('invoice-routing-identifier.help')}
                                placeholder={inferredInvoiceIdentifier ?? undefined}
                                autocomplete="off"
                                value={data.invoice_identifier}
                                error={errors?.invoice_identifier}
                                required={!canInferDefaultInvoiceIdentifier}
                                onInput={(value: string) => {
                                    data.invoice_identifier = value;
                                }}
                            />
                        )}
                    </Fieldset>
                )}
                <Fieldset title={__('global.other-infos')}>
                    <FormField
                        label={__('global.notes')}
                        rows={5}
                        type="textarea"
                        value={data.note}
                        error={errors?.note}
                        onInput={(value: string) => {
                            data.note = value;
                        }}
                    />
                </Fieldset>
                <section class="Form__actions">
                    <Button htmlType="submit" type="primary" icon="save" loading={isSaving}>
                        {isSaving ? __('global.saving') : __('global.save')}
                    </Button>
                    <Button icon="ban" onClick={handleCancel}>
                        {__('global.cancel')}
                    </Button>
                </section>
            </form>
        );
    },
});

export default CompanyEditForm;
