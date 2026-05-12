import './index.scss';
import pick from 'lodash/pick';
import config from '@/globals/config';
import { defineComponent } from 'vue';
import cloneDeep from 'lodash/cloneDeep';
import { AddressField } from '@/utils/address';
import SelectCountry from '@/themes/default/components/SelectCountry';
import FormField from '@/themes/default/components/FormField';
import { VerticalFormKey } from '@/themes/default/components/@constants';
import Fieldset from '@/themes/default/components/Fieldset';
import Button from '@/themes/default/components/Button';

import type Country from '@/utils/country';
import type { ComponentRef, PropType } from 'vue';
import type { AddressFieldDefinition } from '@/utils/country';
import type { ParkDetails, ParkEdit } from '@/stores/api/parks';

type Props = {
    /** Les données déjà sauvegardées du parc (s'il existait déjà). */
    savedData?: ParkDetails | null,

    /** Permet d'indiquer que la sauvegarde est en cours. */
    isSaving?: boolean,

    /** Liste des erreurs de validation éventuelles. */
    errors?: Partial<Record<keyof ParkEdit, string>> | null,

    /**
     * Fonction appelée lorsque l'utilisateur soumet les changements.
     *
     * @param data - Les données soumises.
     */
    onSubmit?(data: ParkEdit): void,

    /**
     * Fonction appelée lorsque l'utilisateur manifeste
     * son souhait d'annuler l'edition.
     */
    onCancel?(): void,
};

type Data = {
    data: ParkEdit,
};

const getDefaults = (savedData: ParkDetails | null): ParkEdit => {
    const BASE_DEFAULTS: ParkEdit = {
        name: '',
        street: null,
        additional_street: null,
        postal_code: null,
        administrative_area: null,
        locality: null,
        country: config.mainCountry,
        opening_hours: '',
        note: '',
    };

    return {
        ...BASE_DEFAULTS,
        ...pick(savedData ?? {}, Object.keys(BASE_DEFAULTS)),
        country: savedData?.country ?? config.mainCountry,
    };
};

/** Formulaire d'édition d'un parc. */
const ParkEditForm = defineComponent({
    name: 'ParkEditForm',
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
    },
    mounted() {
        if (this.isNew) {
            this.$nextTick(() => {
                const $inputName = this.$refs.inputName as ComponentRef<typeof FormField>;
                $inputName?.focus();
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
            isSaving,
            addressFields,
            handleChangeCountry,
            handleSubmit,
            handleCancel,
        } = this;

        return (
            <form
                class="Form Form--fixed-actions ParkEditForm"
                onSubmit={handleSubmit}
            >
                <Fieldset>
                    <FormField
                        ref="inputName"
                        label="name"
                        v-model={data.name}
                        error={errors?.name}
                        required
                    />
                </Fieldset>
                <Fieldset title={__('contact-details')}>
                    <div class="ParkEditForm__address">
                        {addressFields.map((lineFields: AddressFieldDefinition[], index: number) => (
                            <div key={index} class="ParkEditForm__address__group">
                                {lineFields.map((field: AddressFieldDefinition) => {
                                    switch (field.field) {
                                        case AddressField.ADDRESS_LINE1: {
                                            return (
                                                <FormField
                                                    label={__('street')}
                                                    class={[
                                                        'ParkEditForm__address__part',
                                                        `ParkEditForm__address__part--street`,
                                                    ]}
                                                    autocomplete="off"
                                                    value={data.street}
                                                    error={errors?.street}
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
                                                        'ParkEditForm__address__part',
                                                        `ParkEditForm__address__part--additional-street`,
                                                    ]}
                                                    autocomplete="off"
                                                    value={data.additional_street}
                                                    error={errors?.additional_street}
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
                                                        'ParkEditForm__address__part',
                                                        `ParkEditForm__address__part--postal-code`,
                                                    ]}
                                                    autocomplete="off"
                                                    value={data.postal_code}
                                                    error={errors?.postal_code}
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
                                                        'ParkEditForm__address__part',
                                                        `ParkEditForm__address__part--administrative-area`,
                                                    ]}
                                                    autocomplete="off"
                                                    value={data.administrative_area}
                                                    error={errors?.administrative_area}
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
                                                        'ParkEditForm__address__part',
                                                        `ParkEditForm__address__part--locality`,
                                                    ]}
                                                    autocomplete="off"
                                                    value={data.locality}
                                                    error={errors?.locality}
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
                        label="opening-hours"
                        v-model={data.opening_hours}
                        error={errors?.opening_hours}
                    />
                    <FormField
                        label="notes"
                        type="textarea"
                        rows={5}
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

export default ParkEditForm;
