import './index.scss';
import pick from 'lodash/pick';
import config from '@/globals/config';
import { defineComponent } from 'vue';
import cloneDeep from 'lodash/cloneDeep';
import apiRoles from '@/stores/api/roles';
import { AddressField } from '@/utils/address';
import formatOptions from '@/utils/formatOptions';
import FormField from '@/themes/default/components/FormField';
import { VerticalFormKey } from '@/themes/default/components/@constants';
import Fieldset from '@/themes/default/components/Fieldset';
import SelectCountry from '@/themes/default/components/SelectCountry';
import Button from '@/themes/default/components/Button';

import type Country from '@/utils/country';
import type { ComponentRef, PropType } from 'vue';
import type { Options } from '@/utils/formatOptions';
import type { Role } from '@/stores/api/roles';
import type { AddressFieldDefinition } from '@/utils/country';
import type {
    TechnicianEdit,
    TechnicianDetails as Technician,
} from '@/stores/api/technicians';

type Props = {
    /** Les données déjà sauvegardées du technicien (s'il existait déjà). */
    savedData?: Technician | null,

    /** Permet d'indiquer que la sauvegarde est en cours. */
    isSaving?: boolean,

    /** Liste des erreurs de validation éventuelles. */
    errors?: Partial<Record<keyof TechnicianEdit | 'user', string>> | null,

    /**
     * Fonction appelée lorsque l'utilisateur soumet les changements.
     *
     * @param data - Les données soumises.
     * @param withUser - Y'a t'il une création d'utilisateur en même temps ?
     */
    onSubmit?(data: TechnicianEdit, withUser: boolean): void,

    /**
     * Fonction appelée lorsque l'utilisateur manifeste
     * son souhait d'annuler l'edition.
     */
    onCancel?(): void,
};

type Data = {
    data: TechnicianEdit,
    isCreatingRole: boolean,
};

const getDefaults = (savedData: Technician | null): TechnicianEdit => {
    const BASE_DEFAULTS: TechnicianEdit = {
        first_name: '',
        last_name: '',
        nickname: '',
        phone: null,
        email: '',
        street: null,
        additional_street: null,
        postal_code: null,
        administrative_area: null,
        locality: null,
        country: config.mainCountry,
        note: '',
        roles: [],
    };

    const data = {
        ...BASE_DEFAULTS,
        ...pick(savedData ?? {}, Object.keys(BASE_DEFAULTS)),
        email: savedData?.email ?? null,
        roles: (savedData?.roles ?? []).map(({ id }: Role) => id),
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

/** Formulaire d'édition d'un technicien. */
const TechnicianEditForm = defineComponent({
    name: 'TechnicianEditForm',
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
            isCreatingRole: false,
        };
    },
    computed: {
        isNew(): boolean {
            return this.savedData === null;
        },

        allRoles(): Role[] {
            return this.$store.state.roles.list ?? [];
        },

        rolesOptions(): Options<Role> {
            return formatOptions(this.allRoles);
        },

        addressFields(): AddressFieldDefinition[][] {
            return this.data.country.getAddressFields(true);
        },
    },
    created() {
        this.$store.dispatch('roles/fetch');
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

        async handleCreateRole(name: string) {
            if (this.isCreatingRole) {
                return;
            }
            this.isCreatingRole = true;
            const { $t: __, allRoles } = this;

            const existingRole = allRoles.find((_role: Role) => (
                _role.name.toLocaleLowerCase() === name.toLocaleLowerCase()
            ));
            if (existingRole !== undefined) {
                if (!this.data.roles.includes(existingRole.id)) {
                    this.data.roles.push(existingRole.id);
                }
                this.isCreatingRole = false;
                return;
            }

            try {
                const newRole = await apiRoles.create({ name });
                this.$store.dispatch('roles/refresh');

                this.data.roles.push(newRole.id);
                this.$toasted.success(__('quick-creation.role.success', { name: newRole.name }));
            } catch {
                this.$toasted.error(__('quick-creation.role.failure'));
            } finally {
                this.isCreatingRole = false;
            }
        },

        handleSubmit(e: SubmitEvent) {
            e?.preventDefault();

            const { data } = this;
            this.$emit('submit', cloneDeep(data));
        },

        handleCancel() {
            this.$emit('cancel');
        },
    },
    render() {
        const {
            $t: __,
            data,
            addressFields,
            errors,
            rolesOptions,
            isSaving,
            handleCreateRole,
            handleChangeCountry,
            handleSubmit,
            handleCancel,
        } = this;

        return (
            <form
                class="Form Form--fixed-actions TechnicianEditForm"
                onSubmit={handleSubmit}
            >
                <Fieldset>
                    <div class="TechnicianEditForm__name">
                        <FormField
                            ref="inputFirstName"
                            label="first-name"
                            class="TechnicianEditForm__first-name"
                            value={data.first_name}
                            error={errors?.first_name}
                            autocomplete="off"
                            onInput={(value: string) => {
                                data.first_name = value;
                            }}
                            required
                        />
                        <FormField
                            label="last-name"
                            class="TechnicianEditForm__last-name"
                            value={data.last_name}
                            error={errors?.last_name}
                            autocomplete="off"
                            onInput={(value: string) => {
                                data.last_name = value;
                            }}
                            required
                        />
                    </div>
                    <FormField
                        label="nickname"
                        value={data.nickname}
                        error={errors?.nickname}
                        onInput={(value: string) => {
                            data.nickname = value;
                        }}
                    />
                </Fieldset>
                <Fieldset title={__('contact-details')}>
                    <FormField
                        label="phone"
                        type="tel"
                        autocomplete="off"
                        value={data.phone}
                        error={errors?.phone}
                        onInput={(value: string) => {
                            data.phone = value;
                        }}
                    />
                    <FormField
                        label="email"
                        type="email"
                        autocomplete="off"
                        value={data.email}
                        error={errors?.email}
                        onInput={(value: string) => {
                            data.email = value;
                        }}
                    />
                    <div class="TechnicianEditForm__address">
                        {addressFields.map((lineFields: AddressFieldDefinition[], index: number) => (
                            <div key={index} class="TechnicianEditForm__address__group">
                                {lineFields.map((field: AddressFieldDefinition) => {
                                    switch (field.field) {
                                        case AddressField.ADDRESS_LINE1: {
                                            return (
                                                <FormField
                                                    label={__('street')}
                                                    class={[
                                                        'TechnicianEditForm__address__part',
                                                        `TechnicianEditForm__address__part--street`,
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
                                                        'TechnicianEditForm__address__part',
                                                        `TechnicianEditForm__address__part--additional-street`,
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
                                                        'TechnicianEditForm__address__part',
                                                        `TechnicianEditForm__address__part--postal-code`,
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
                                                        'TechnicianEditForm__address__part',
                                                        `TechnicianEditForm__address__part--administrative-area`,
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
                                                        'TechnicianEditForm__address__part',
                                                        `TechnicianEditForm__address__part--locality`,
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
                        label="notes"
                        type="textarea"
                        rows={5}
                        class="TechnicianEditForm__notes"
                        v-model={data.note}
                        error={errors?.note}
                    />
                    <FormField
                        type="select"
                        label="page.technician-edit.roles.label"
                        help={__('page.technician-edit.roles.help')}
                        options={rolesOptions}
                        class="TechnicianEditForm__roles"
                        v-model={data.roles}
                        error={errors?.roles}
                        onCreate={handleCreateRole}
                        canCreate
                        multiple
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

export default TechnicianEditForm;
