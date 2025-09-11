import './index.scss';
import pick from 'lodash/pick';
import cloneDeep from 'lodash/cloneDeep';
import { defineComponent } from 'vue';
import formatOptions from '@/utils/formatOptions';
import FormField from '@/themes/default/components/FormField';
import Fieldset from '@/themes/default/components/Fieldset';
import Button from '@/themes/default/components/Button';
import { Group } from '@/stores/api/groups';

import type { PropType, ComponentRef } from 'vue';
import type { UserDetails, UserEdit } from '@/stores/api/users';
import type { GroupDetails } from '@/stores/api/groups';
import type { Options } from '@/utils/formatOptions';

type Props = {
    /** Les données déjà sauvegardées de l'utilisateur (si existantes). */
    savedData?: UserDetails | null,

    /** Permet d'indiquer que la sauvegarde est en cours. */
    isSaving?: boolean,

    /** Liste des erreurs de validation éventuelles. */
    errors?: Partial<Record<keyof UserEdit, string>>,
};

type Data = {
    data: UserEdit,
};

const DEFAULT_VALUES: Data['data'] = Object.freeze({
    first_name: '',
    last_name: '',
    pseudo: '',
    email: '',
    phone: '',
    password: '',
    group: Group.OPERATION,
});

/** Formulaire d'édition d'un utilisateur. */
const UserEditForm = defineComponent({
    name: 'UserEditForm',
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
            type: Object as PropType<Props['errors']>,
            default: undefined,
        },
    },
    emits: ['change', 'submit', 'cancel'],
    data(): Data {
        const data: UserEdit = {
            ...DEFAULT_VALUES,
            ...pick(this.savedData ?? {}, Object.keys(DEFAULT_VALUES)),
        };

        return {
            data,
        };
    },
    computed: {
        isNew(): boolean {
            return this.savedData === null;
        },

        groupsOptions(): Options<GroupDetails> {
            const groups = this.$store.state.groups.list;
            return formatOptions(groups);
        },
    },
    created() {
        this.$store.dispatch('groups/fetch');
        this.$store.dispatch('parks/fetch');
    },
    mounted() {
        if (this.isNew) {
            this.$nextTick(() => {
                const $inputPseudo = this.$refs.inputPseudo as ComponentRef<typeof FormField>;
                $inputPseudo?.focus();
            });
        }
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleSubmit(e: SubmitEvent) {
            e.preventDefault();

            this.$emit('submit', cloneDeep(this.data));
        },

        handleCancel() {
            this.$emit('cancel');
        },

        handleGroupChange() {
            this.$emit('change', cloneDeep(this.data));
        },
    },
    render() {
        const {
            $t: __,
            isNew,
            isSaving,
            data,
            errors,
            groupsOptions,
            handleSubmit,
            handleCancel,
            handleGroupChange,
        } = this;

        return (
            <form class="Form Form--fixed-actions" onSubmit={handleSubmit}>
                <Fieldset>
                    <FormField
                        ref="inputPseudo"
                        label="pseudo"
                        autocomplete="off"
                        value={data.pseudo}
                        error={errors?.pseudo}
                        onInput={(newValue: string) => {
                            data.pseudo = newValue;
                        }}
                        required
                    />
                    <FormField
                        label="email"
                        type="email"
                        autocomplete="off"
                        value={data.email}
                        error={errors?.email}
                        onInput={(newValue: string) => {
                            data.email = newValue;
                        }}
                        required
                    />
                    {isNew && (
                        <FormField
                            label="password"
                            type="password"
                            autocomplete="new-password"
                            value={data.password}
                            error={errors?.password}
                            onInput={(newValue: string) => {
                                data.password = newValue;
                            }}
                            required
                        />
                    )}
                    <FormField
                        label="access"
                        type="select"
                        v-model={data.group}
                        options={groupsOptions}
                        error={errors?.group}
                        onChange={handleGroupChange}
                        help={__('page.user.help-group')}
                        placeholder={false}
                        required
                    />
                </Fieldset>
                <Fieldset title={__('personal-infos')}>
                    <div class="UserEditForm__name">
                        <FormField
                            label="first-name"
                            class="UserEditForm__first-name"
                            autocomplete="off"
                            v-model={data.first_name}
                            error={errors?.first_name}
                            required
                        />
                        <FormField
                            label="last-name"
                            class="UserEditForm__last-name"
                            autocomplete="off"
                            v-model={data.last_name}
                            error={errors?.last_name}
                            required
                        />
                    </div>
                    <FormField
                        label="phone"
                        type="tel"
                        autocomplete="off"
                        v-model={data.phone}
                        error={errors?.phone}
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

export default UserEditForm;
