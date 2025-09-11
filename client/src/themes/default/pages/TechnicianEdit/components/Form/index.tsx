import './index.scss';
import { defineComponent } from 'vue';
import pick from 'lodash/pick';
import cloneDeep from 'lodash/cloneDeep';
import formatOptions from '@/utils/formatOptions';
import apiRoles from '@/stores/api/roles';
import { Group } from '@/stores/api/groups';
import FormField from '@/themes/default/components/FormField';
import Fieldset from '@/themes/default/components/Fieldset';
import Button from '@/themes/default/components/Button';

import type { ComponentRef, PropType } from 'vue';
import type { Options } from '@/utils/formatOptions';
import type { Country } from '@/stores/api/countries';
import type { Role } from '@/stores/api/roles';
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

const DEFAULT_VALUES: TechnicianEdit = Object.freeze({
    first_name: '',
    last_name: '',
    nickname: '',
    phone: '',
    email: '',
    street: '',
    postal_code: '',
    locality: '',
    country_id: null,
    note: '',
    roles: [],
});

/** Formulaire d'édition d'un technicien. */
const TechnicianEditForm = defineComponent({
    name: 'TechnicianEditForm',
    provide: {
        verticalForm: true,
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
        const data: TechnicianEdit = {
            ...DEFAULT_VALUES,
            ...pick(this.savedData ?? {}, Object.keys(DEFAULT_VALUES)),
            email: this.savedData?.email ?? null,
            roles: (this.savedData?.roles ?? []).map(({ id }: Role) => id),
        };

        return {
            data,
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

        countriesOptions(): Options<Country> {
            return this.$store.getters['countries/options'];
        },

        rolesOptions(): Options<Role> {
            return formatOptions(this.allRoles);
        },

        isAdmin(): boolean {
            return this.$store.getters['auth/is'](Group.ADMINISTRATION);
        },

        hasUserAccount(): boolean {
            return !!this.savedData?.user;
        },
    },
    created() {
        this.$store.dispatch('countries/fetch');
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
            hasUserAccount,
            savedData,
            isAdmin,
            errors,
            rolesOptions,
            countriesOptions,
            isSaving,
            handleCreateRole,
            handleSubmit,
            handleCancel,
        } = this;

        const renderUserAccountSection = (): JSX.Element | null => {
            if (!isAdmin) {
                return null;
            }

            if (hasUserAccount) {
                const user = savedData!.user!;

                return (
                    <Fieldset title={__('page.technician-edit.user-account')}>
                        <div class="TechnicianEditForm__existing-user-help">
                            {__('page.technician-edit.existing-user-help')}
                        </div>
                        <div class="TechnicianEditForm__existing-user">
                            <div class="TechnicianEditForm__existing-user__pseudo">
                                <div class="TechnicianEditForm__existing-user__label">
                                    {__('pseudo')}
                                </div>
                                <div class="TechnicianEditForm__existing-user__value">
                                    {user.pseudo}
                                </div>
                            </div>
                            <div class="TechnicianEditForm__existing-user__email">
                                <div class="TechnicianEditForm__existing-user__label">
                                    {__('email')}
                                </div>
                                <div class="TechnicianEditForm__existing-user__value">
                                    {user.email}
                                </div>
                            </div>
                        </div>
                    </Fieldset>
                );
            }

            return null;
        };

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
                    <FormField
                        label="street"
                        autocomplete="off"
                        value={data.street}
                        error={errors?.street}
                        onInput={(value: string) => {
                            data.street = value;
                        }}
                    />
                    <div class="TechnicianEditForm__locality">
                        <FormField
                            label="postal-code"
                            class="TechnicianEditForm__postal-code"
                            autocomplete="off"
                            value={data.postal_code}
                            error={errors?.postal_code}
                            onInput={(value: string) => {
                                data.postal_code = value;
                            }}
                        />
                        <FormField
                            label="city"
                            class="TechnicianEditForm__city"
                            autocomplete="off"
                            value={data.locality}
                            error={errors?.locality}
                            onInput={(value: string) => {
                                data.locality = value;
                            }}
                        />
                    </div>
                    <FormField
                        label="country"
                        type="select"
                        autocomplete="off"
                        options={countriesOptions}
                        v-model={data.country_id}
                        error={errors?.country_id}
                    />
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
                {renderUserAccountSection()}
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
