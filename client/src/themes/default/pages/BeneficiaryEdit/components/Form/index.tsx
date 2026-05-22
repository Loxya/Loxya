import './index.scss';
import pick from 'lodash/pick';
import { defineComponent } from 'vue';
import cloneDeep from 'lodash/cloneDeep';
import { AddressField } from '@/utils/address';
import config, { BillingMode } from '@/globals/config';
import FormField from '@/themes/default/components/FormField';
import { VerticalFormKey } from '@/themes/default/components/@constants';
import Fieldset from '@/themes/default/components/Fieldset';
import SelectCountry from '@/themes/default/components/SelectCountry';
import Button from '@/themes/default/components/Button';
import SelectCompany from './SelectCompany';

import type Country from '@/utils/country';
import type { ComponentRef, PropType } from 'vue';
import type { Company } from '@/stores/api/companies';
import type { AddressFieldDefinition } from '@/utils/country';
import type {
    BeneficiaryEdit,
    BeneficiaryDetails as Beneficiary,
} from '@/stores/api/beneficiaries';

type Props = {
    /** Les données déjà sauvegardées du bénéficiaire (s'il existait déjà). */
    savedData?: Beneficiary | null,

    /** Permet d'indiquer que la sauvegarde est en cours. */
    isSaving?: boolean,

    /** Liste des erreurs de validation éventuelles. */
    errors?: Record<string, string> | null,

    /**
     * Fonction appelée lorsque l'utilisateur soumet les changements.
     *
     * @param data - Les données soumises.
     */
    onSubmit?(data: BeneficiaryEdit): void,

    /**
     * Fonction appelée lorsque l'utilisateur manifeste
     * son souhait d'annuler l'edition.
     */
    onCancel?(): void,
};

type Data = {
    data: BeneficiaryEdit,
};

const getDefaults = (savedData: Beneficiary | null): BeneficiaryEdit => {
    const BASE_DEFAULTS: BeneficiaryEdit = {
        first_name: '',
        last_name: '',
        reference: null,
        company_id: null,
        phone: null,
        email: null,
        street: null,
        additional_street: null,
        postal_code: null,
        administrative_area: null,
        locality: null,
        country: config.mainCountry,
        note: null,
        pseudo: '',
        password: '',
    };

    const data = {
        ...BASE_DEFAULTS,
        ...pick(savedData ?? {}, Object.keys(BASE_DEFAULTS)),
        email: savedData?.user?.email ?? savedData?.email ?? null,
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

/** Formulaire d'édition d'un bénéficiaire. */
const BeneficiaryEditForm = defineComponent({
    name: 'BeneficiaryEditForm',
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
    emits: ['cancel', 'submit'],
    data(): Data {
        return {
            data: getDefaults(this.savedData),
        };
    },
    computed: {
        isNew(): boolean {
            return this.savedData === null;
        },

        addressFields(): AddressFieldDefinition[][] {
            return this.data.country.getAddressFields(true);
        },

        isBillingEnabled(): boolean {
            return config.billingMode !== BillingMode.NONE;
        },

        isAddressRequired(): boolean {
            // - Si la facturation est désactivée, on ne rend pas les adresses obligatoires.
            if (!this.isBillingEnabled) {
                return false;
            }

            // - Si le bénéficiaire est lié à une société,
            //   les exigences s'appliquent à la société.
            if (this.data.company_id !== null) {
                return false;
            }

            const sellerCountry = config.organization.country;
            return sellerCountry.requireBuyerAddress(false);
        },
    },
    mounted() {
        if (this.isNew) {
            this.$nextTick(() => {
                const $inputFirstName = this.$refs.inputFirstName as ComponentRef<typeof FormField>;
                $inputFirstName?.focus();
            });
        }
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleChangeCompany(companyId: Company['id'] | null) {
            this.data.company_id = companyId || null;
        },

        handleChangeCountry(newCountry: Country) {
            this.data.country = newCountry;

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

        handleSubmit(e: SubmitEvent) {
            e?.preventDefault();

            this.$emit('submit', cloneDeep(this.data));
        },

        handleCancel() {
            this.$emit('cancel');
        },
    },
    render() {
        const {
            $t: __,
            data,
            errors,
            savedData,
            isAddressRequired,
            addressFields,
            isSaving,
            handleChangeCompany,
            handleChangeCountry,
            handleSubmit,
            handleCancel,
        } = this;

        return (
            <form
                class="Form Form--fixed-actions BeneficiaryEditForm"
                onSubmit={handleSubmit}
            >
                <Fieldset>
                    <div class="BeneficiaryEditForm__name">
                        <FormField
                            ref="inputFirstName"
                            label="first-name"
                            class="BeneficiaryEditForm__first-name"
                            v-model={data.first_name}
                            error={errors?.first_name}
                            autocomplete="off"
                            required
                        />
                        <FormField
                            label="last-name"
                            class="BeneficiaryEditForm__last-name"
                            v-model={data.last_name}
                            error={errors?.last_name}
                            autocomplete="off"
                            required
                        />
                    </div>
                    <FormField
                        label="reference"
                        v-model={data.reference}
                        error={errors?.reference}
                        help={__('page.beneficiary-edit.help-reference')}
                    />
                </Fieldset>
                <Fieldset title={__('company')}>
                    <SelectCompany
                        defaultCompany={savedData?.company ?? null}
                        onChange={handleChangeCompany}
                    />
                </Fieldset>
                <Fieldset title={__('contact-details')}>
                    <FormField
                        label="phone"
                        type="tel"
                        autocomplete="off"
                        v-model={data.phone}
                        error={errors?.phone}
                    />
                    <FormField
                        label="email"
                        type="email"
                        autocomplete="off"
                        v-model={data.email}
                        error={errors?.email}
                    />
                    <div class="BeneficiaryEditForm__address">
                        {addressFields.map((lineFields: AddressFieldDefinition[], index: number) => (
                            <div key={index} class="BeneficiaryEditForm__address__group">
                                {lineFields.map((field: AddressFieldDefinition) => {
                                    switch (field.field) {
                                        case AddressField.ADDRESS_LINE1: {
                                            return (
                                                <FormField
                                                    label={__('street')}
                                                    class={[
                                                        'BeneficiaryEditForm__address__part',
                                                        `BeneficiaryEditForm__address__part--street`,
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
                                                    label={__('additional-street')}
                                                    class={[
                                                        'BeneficiaryEditForm__address__part',
                                                        `BeneficiaryEditForm__address__part--additional-street`,
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
                                                    label={__(`postal-code.${field.type}`)}
                                                    class={[
                                                        'BeneficiaryEditForm__address__part',
                                                        `BeneficiaryEditForm__address__part--postal-code`,
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
                                                    label={__(`administrative-area.${field.type}`)}
                                                    class={[
                                                        'BeneficiaryEditForm__address__part',
                                                        `BeneficiaryEditForm__address__part--administrative-area`,
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
                                                    label={__(`locality.${field.type}`)}
                                                    class={[
                                                        'BeneficiaryEditForm__address__part',
                                                        `BeneficiaryEditForm__address__part--locality`,
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
                    <FormField label="country" type="custom" error={errors?.country}>
                        <SelectCountry
                            placeholder={false}
                            value={data.country}
                            onChange={handleChangeCountry}
                        />
                    </FormField>
                </Fieldset>
                <Fieldset title={__('other-infos')}>
                    <FormField
                        label="notes"
                        type="textarea"
                        rows={4}
                        v-model={data.note}
                        error={errors?.note}
                    />
                </Fieldset>
                <section class="Form__actions">
                    <Button htmlType="submit" type="primary" icon="save" loading={isSaving}>
                        {isSaving ? __('saving') : __('save')}
                    </Button>
                    <Button icon="ban" onClick={handleCancel}>
                        {__('cancel')}
                    </Button>
                </section>
            </form>
        );
    },
});

export default BeneficiaryEditForm;
