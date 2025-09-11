import './index.scss';
import { defineComponent } from 'vue';
import apiRoles from '@/stores/api/roles';
import { confirm } from '@/utils/alert';
import showModal from '@/utils/showModal';
import stringCompare from '@/utils/stringCompare';
import Page from '@/themes/default/components/Page';
import CriticalError from '@/themes/default/components/CriticalError';
import EmptyMessage from '@/themes/default/components/EmptyMessage';
import Loading from '@/themes/default/components/Loading';
import Button from '@/themes/default/components/Button';
import Icon from '@/themes/default/components/Icon';

// - Modales
import EditRole from '@/themes/default/modals/EditRole';

import type { Role } from '@/stores/api/roles';

type Data = {
    roles: Role[],
    isFetched: boolean,
    processing: Array<Role['id']>,
    hasCriticalError: boolean,
};

/** Page de listing des rôles des techniciens. */
const Roles = defineComponent({
    name: 'Roles',
    data: (): Data => ({
        roles: [],
        isFetched: false,
        processing: [],
        hasCriticalError: false,
    }),
    computed: {
        sortedRoles(): Role[] {
            const { roles } = this;
            return [...roles].sort((a: Role, b: Role) => (
                stringCompare(a.name, b.name)
            ));
        },
    },
    mounted() {
        this.fetchData();
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        async handleCreate() {
            const newRole: Role | undefined = (
                await showModal(this.$modal, EditRole)
            );

            // - Si l'ajout a été annulé, on retourne sans autre.
            if (newRole === undefined) {
                return;
            }

            const { __ } = this;
            this.$toasted.success(__('saved'));

            this.roles.push(newRole);
            this.fetchData();
        },

        async handleEdit(id: Role['id']) {
            const role = this.roles.find((_role: Role) => _role.id === id);
            if (this.processing.includes(id) || role === undefined) {
                return;
            }
            this.processing.push(id);

            const updatedRole: Role | undefined = (
                await showModal(this.$modal, EditRole, { role })
            );

            this.$delete(this.processing, this.processing.indexOf(id));

            // - Si l'édition a été annulée, on retourne sans autre.
            if (updatedRole === undefined) {
                return;
            }

            const { __ } = this;
            this.$toasted.success(__('saved'));

            const toUpdateIndex = this.roles.findIndex((_role: Role) => _role.id === id);
            this.$set(this.roles, toUpdateIndex, updatedRole);
            this.fetchData();
        },

        async handleRemove(id: Role['id']) {
            const role = this.roles.find((_role: Role) => _role.id === id);
            if (this.processing.includes(id) || role === undefined || role.is_used) {
                return;
            }
            this.processing.push(id);

            const { __ } = this;

            const isConfirmed = await confirm({
                type: 'danger',
                text: __('confirm-permanently-delete'),
                confirmButtonText: __('global.yes-permanently-delete'),
            });
            if (!isConfirmed) {
                this.$delete(this.processing, this.processing.indexOf(id));
                return;
            }

            // Note: On utilise pas `this.roles.indexOf(role)` car la liste a
            //       pu changer depuis (vu le await plus haut).
            const index = this.roles.findIndex((_role: Role) => _role.id === id);
            if (index !== -1) {
                this.$delete(this.roles, index);
            }

            try {
                await apiRoles.remove(id);
                this.$toasted.success(__('deleted'));
                this.$store.dispatch('roles/refresh');
            } catch {
                this.$toasted.error(__('global.errors.unexpected-while-deleting'));
                this.fetchData();
            } finally {
                this.$delete(this.processing, this.processing.indexOf(id));
            }
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        async fetchData() {
            try {
                this.roles = await apiRoles.all();
                this.isFetched = true;
            } catch {
                this.hasCriticalError = true;
            }
        },

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            key = !key.startsWith('global.')
                ? `page.roles.${key}`
                : key.replace(/^global\./, '');

            return this.$t(key, params, count);
        },
    },
    render() {
        const {
            __,
            roles,
            isFetched,
            hasCriticalError,
            processing,
            handleCreate,
            handleEdit,
            handleRemove,
        } = this;

        if (hasCriticalError || !isFetched) {
            return (
                <Page name="roles" title={__('title')} centered>
                    {hasCriticalError ? <CriticalError /> : <Loading />}
                </Page>
            );
        }

        if (roles.length === 0) {
            return (
                <Page name="roles" title={__('title')} help={__('help')} centered>
                    <div class="Roles">
                        <EmptyMessage
                            message={__('no-role-yet')}
                            action={{
                                icon: 'plus',
                                type: 'add',
                                label: __('create-first-role'),
                                onClick: handleCreate,
                            }}
                        />
                    </div>
                </Page>
            );
        }

        return (
            <Page
                name="roles"
                title={__('title')}
                help={__('help')}
                actions={[
                    <Button type="add" onClick={handleCreate} collapsible>
                        {__('action-add')}
                    </Button>,
                ]}
            >
                <ul class="Roles__list">
                    {roles.map(({ id, name, is_used: isUsed }: Role) => (
                        <li key={id} class="Roles__list__item">
                            <span class="Roles__list__item__name">
                                {(
                                    processing.includes(id)
                                        ? <Icon name="circle-notch" spin />
                                        : <Icon name="tools" />
                                )}
                                {name}
                            </span>
                            <span class="Roles__list__item__actions">
                                <Button
                                    type="edit"
                                    onClick={() => { handleEdit(id); }}
                                    disabled={processing.includes(id)}
                                />
                                <Button
                                    type="trash"
                                    onClick={() => { handleRemove(id); }}
                                    disabled={isUsed || processing.includes(id)}
                                    tooltip={isUsed ? __('role-used') : ''}
                                />
                            </span>
                        </li>
                    ))}
                </ul>
            </Page>
        );
    },
});

export default Roles;
