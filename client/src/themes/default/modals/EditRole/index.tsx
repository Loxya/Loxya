import './index.scss';
import { RequestError } from '@/globals/requester';
import { defineComponent } from 'vue';
import { ApiErrorCode } from '@/stores/api/@codes';
import apiRoles from '@/stores/api/roles';
import FormField from '@/themes/default/components/FormField';
import Button from '@/themes/default/components/Button';

import type { Role, RoleEdit } from '@/stores/api/roles';
import type { PropType } from 'vue';

type Props = {
    /**
     * Le rôle de technicien à modifier.
     * Si non fourni, on considérera que c'est un ajout.
     */
    role?: Role,
};

type Data = {
    name: RoleEdit['name'],
    isSaving: boolean,
    validationErrors: Record<string, string> | null,
};

/** Modale permettant de créer ou modifier un rôle de technicien. */
const EditRole = defineComponent({
    name: 'EditRole',
    provide: {
        verticalForm: true,
    },
    modal: {
        width: 600,
        draggable: true,
        clickToClose: false,
    },
    props: {
        role: {
            type: Object as PropType<Props['role']>,
            default: undefined,
        },
    },
    emits: ['saved', 'close'],
    data(): Data {
        return {
            name: this.role?.name ?? '',
            isSaving: false,
            validationErrors: null,
        };
    },
    computed: {
        title(): string {
            const { __ } = this;

            return this.role === undefined
                ? __('title-create')
                : __('title-edit');
        },
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleSubmit(e: SubmitEvent) {
            e?.preventDefault();

            this.save();
        },

        handleSave() {
            this.save();
        },

        handleClose() {
            this.$emit('close', undefined);
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        async save() {
            if (this.isSaving) {
                return;
            }
            this.isSaving = true;
            const { __, role, name } = this;

            try {
                const updatedRole = role === undefined
                    ? await apiRoles.create({ name })
                    : await apiRoles.update(role.id, { name });

                this.$store.dispatch('roles/refresh');

                this.$emit('saved');
                this.$emit('close', updatedRole);
            } catch (error) {
                this.isSaving = false;

                if (error instanceof RequestError && error.code === ApiErrorCode.VALIDATION_FAILED) {
                    this.validationErrors = { ...error.details };
                    return;
                }

                // eslint-disable-next-line no-console
                console.error(`Error occurred while saving the role`, error);
                this.$toasted.error(__('global.errors.unexpected-while-saving'));
            }
        },

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            key = !key.startsWith('global.')
                ? `modal.edit-role.${key}`
                : key.replace(/^global\./, '');

            return this.$t(key, params, count);
        },
    },
    render() {
        const {
            __,
            title,
            isSaving,
            validationErrors,
            handleSubmit,
            handleSave,
            handleClose,
        } = this;

        return (
            <div class="EditRole">
                <header class="EditRole__header">
                    <h2 class="EditRole__header__title">{title}</h2>
                    <Button
                        type="close"
                        class="EditRole__header__close-button"
                        onClick={handleClose}
                    />
                </header>
                <div class="EditRole__body">
                    <form class="EditRole__form" onSubmit={handleSubmit}>
                        <FormField
                            type="text"
                            label={__('role-name')}
                            class="EditRole__form__input-name"
                            value={this.name}
                            error={validationErrors?.name}
                            onInput={(value: string) => {
                                this.name = value;
                            }}
                            required
                        />
                    </form>
                </div>
                <div class="EditRole__footer">
                    <Button type="primary" onClick={handleSave} loading={isSaving}>
                        {isSaving ? __('global.saving') : __('global.save')}
                    </Button>
                    <Button onClick={handleClose}>
                        {__('global.cancel')}
                    </Button>
                </div>
            </div>
        );
    },
});

export default EditRole;
