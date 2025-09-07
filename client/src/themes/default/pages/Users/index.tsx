import './index.scss';
import pick from 'lodash/pick';
import isEqual from 'lodash/isEqual';
import throttle from 'lodash/throttle';
import { HttpCode, RequestError } from '@/globals/requester';
import isTruthy from '@/utils/isTruthy';
import { confirm } from '@/utils/alert';
import apiUsers from '@/stores/api/users';
import mergeDifference from '@/utils/mergeDifference';
import { defineComponent } from 'vue';
import { DEBOUNCE_WAIT_DURATION } from '@/globals/constants';
import { Group } from '@/stores/api/groups';
import Fragment from '@/components/Fragment';
import Page from '@/themes/default/components/Page';
import Dropdown from '@/themes/default/components/Dropdown';
import CriticalError from '@/themes/default/components/CriticalError';
import Icon from '@/themes/default/components/Icon';
import Button from '@/themes/default/components/Button';
import FiltersPanel, { FiltersSchema } from './components/Filters';
import {
    ServerTable,
    getLegacySavedSearch,
} from '@/themes/default/components/Table';
import {
    persistFilters,
    getPersistedFilters,
    clearPersistedFilters,
} from '@/utils/filtersPersister';

import type { DebouncedMethod } from 'lodash';
import type { User } from '@/stores/api/users';
import type { Filters } from './components/Filters';
import type { ComponentRef, CreateElement } from 'vue';
import type { Columns } from '@/themes/default/components/Table/Server';
import type { PaginationParams, SortableParams } from '@/stores/api/@types';
import type { Session } from '@/stores/api/session';

type Data = {
    filters: Filters,
    isLoading: boolean,
    hasCriticalError: boolean,
    shouldDisplayTrashed: boolean,
    isTrashDisplayed: boolean,
};

type InstanceProperties = {
    refreshTableDebounced: (
        | DebouncedMethod<typeof Users, 'refreshTable'>
        | undefined
    ),
};

/** La clé utilisé pour la persistence des filtres de la page. */
const FILTERS_PERSISTENCE_KEY = 'Users--filters';

/** Page de listing des utilisateurs. */
const Users = defineComponent({
    name: 'Users',
    setup: (): InstanceProperties => ({
        refreshTableDebounced: undefined,
    }),
    data(): Data {
        const filters: Filters = {
            search: [],
            group: null,
        };

        // - Filtres sauvegardés.
        const session = this.$store.state.auth.user as Session;
        if (!session.disable_search_persistence) {
            const savedFilters = getPersistedFilters(FILTERS_PERSISTENCE_KEY, FiltersSchema);
            if (savedFilters !== null) {
                Object.assign(filters, savedFilters);
            } else {
                // - Ancienne sauvegarde éventuelle, dans le component `<Table />`.
                const savedSearchLegacy = this.$options.name
                    ? getLegacySavedSearch(this.$options.name)
                    : null;

                if (savedSearchLegacy !== null) {
                    Object.assign(filters, { search: [savedSearchLegacy] });
                }
            }
        } else {
            clearPersistedFilters(FILTERS_PERSISTENCE_KEY);
        }

        return {
            isLoading: false,
            hasCriticalError: false,
            shouldDisplayTrashed: false,
            isTrashDisplayed: false,
            filters,
        };
    },
    computed: {
        shouldPersistSearch(): boolean {
            const session = this.$store.state.auth.user as Session;
            return !session.disable_search_persistence;
        },

        currentUserId(): User['id'] {
            return this.$store.state.auth.user.id;
        },

        columns(): Columns<User> {
            const {
                $t: __,
                currentUserId,
                isTrashDisplayed,
                handleDeleteItemClick,
                handleRestoreItemClick,
            } = this;

            return [
                {
                    key: 'full_name',
                    title: `${__('first-name')} / ${__('last-name')}`,
                    class: [
                        'Users__table__cell',
                        'Users__table__cell--name',
                    ],
                    hideable: false,
                    sortable: true,
                    render: (h: CreateElement, user: User) => {
                        const isActiveUser = user.id === currentUserId;

                        return (
                            <span class="Users__name">
                                <Icon name={isActiveUser ? 'user-circle' : 'user'} />
                                <span class="Users__name__data">
                                    <span class="Users__full-name">{user.full_name}</span>
                                    <span class="Users__pseudo">@{user.pseudo}</span>
                                </span>
                            </span>
                        );
                    },
                },
                {
                    key: 'group',
                    title: __('access'),
                    class: [
                        'Users__table__cell',
                        'Users__table__cell--group',
                    ],
                    sortable: true,
                    render: (h: CreateElement, user: User) => (
                        this.$store.getters['groups/getName'](user.group)
                    ),
                },
                {
                    key: 'email',
                    title: __('email'),
                    class: [
                        'Users__table__cell',
                        'Users__table__cell--email',
                    ],
                    sortable: true,
                    render: (h: CreateElement, user: User) => {
                        const isActiveUser = user.id === currentUserId;
                        if (isActiveUser || isTrashDisplayed) {
                            return user.email;
                        }
                        return <a href={`mailto:${user.email}`}>{user.email}</a>;
                    },
                },
                !isTrashDisplayed && {
                    key: 'phone',
                    title: __('phone'),
                    class: [
                        'Users__table__cell',
                        'Users__table__cell--phone',
                    ],
                    render: (h: CreateElement, { phone }: User) => (
                        phone ?? (
                            <span class="Users__table__cell__empty">
                                {__('not-specified')}
                            </span>
                        )
                    ),
                },
                {
                    key: 'actions',
                    class: [
                        'Users__table__cell',
                        'Users__table__cell--actions',
                    ],
                    render: (h: CreateElement, user: User) => {
                        const isActiveUser = user.id === currentUserId;
                        if (isActiveUser) {
                            return null;
                        }

                        const isUserAdmin = user.group === Group.ADMINISTRATION;
                        if (isTrashDisplayed) {
                            return (
                                <Fragment>
                                    <Button
                                        type="restore"
                                        onClick={(e: MouseEvent) => {
                                            handleRestoreItemClick(e, user.id);
                                        }}
                                    />
                                    {!isUserAdmin && (
                                        <Button
                                            type="delete"
                                            onClick={(e: MouseEvent) => {
                                                handleDeleteItemClick(e, user.id);
                                            }}
                                        />
                                    )}
                                </Fragment>
                            );
                        }

                        return (
                            <Dropdown>
                                <Button
                                    type="edit"
                                    to={{
                                        name: 'edit-user',
                                        params: { id: user.id.toString() },
                                    }}
                                >
                                    {__('action-edit')}
                                </Button>
                                {!isUserAdmin && (
                                    <Button
                                        type="trash"
                                        onClick={(e: MouseEvent) => {
                                            handleDeleteItemClick(e, user.id);
                                        }}
                                    >
                                        {__('action-delete')}
                                    </Button>
                                )}
                            </Dropdown>
                        );
                    },
                },
            ].filter(isTruthy);
        },
    },
    watch: {
        filters: {
            handler() {
                this.refreshTableDebounced!();

                if (this.shouldPersistSearch) {
                    persistFilters(FILTERS_PERSISTENCE_KEY, this.filters);
                }
            },
            deep: true,
        },
    },
    created() {
        this.$store.dispatch('groups/fetch');

        // - Binding.
        this.fetch = this.fetch.bind(this);

        // - Debounce.
        this.refreshTableDebounced = throttle(
            this.refreshTable.bind(this),
            DEBOUNCE_WAIT_DURATION.asMilliseconds(),
            { leading: false },
        );
    },
    beforeDestroy() {
        this.refreshTableDebounced?.cancel();
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        async handleDeleteItemClick(e: MouseEvent, id: User['id']) {
            e.preventDefault();

            const { $t: __ } = this;
            const isSoft = !this.isTrashDisplayed;

            const isConfirmed = await confirm({
                type: 'danger',
                text: isSoft
                    ? __('page.users.confirm-delete')
                    : __('page.users.confirm-permanently-delete'),
                confirmButtonText: isSoft
                    ? __('yes-trash')
                    : __('yes-permanently-delete'),
            });
            if (!isConfirmed) {
                return;
            }

            this.isLoading = true;
            try {
                await apiUsers.remove(id);
                this.refreshTable();
            } catch {
                this.$toasted.error(__('errors.unexpected-while-deleting'));
            } finally {
                this.isLoading = false;
            }
        },

        async handleRestoreItemClick(e: MouseEvent, id: User['id']) {
            e.stopPropagation();
            const { $t: __ } = this;

            const isConfirmed = await confirm({
                text: __('page.users.confirm-restore'),
                confirmButtonText: __('yes-restore'),
            });
            if (!isConfirmed) {
                return;
            }

            this.isLoading = true;
            try {
                await apiUsers.restore(id);
                this.refreshTable();
            } catch {
                this.$toasted.error(__('errors.unexpected-while-restoring'));
            } finally {
                this.isLoading = false;
            }
        },

        handleToggleShowTrashed() {
            this.shouldDisplayTrashed = !this.shouldDisplayTrashed;
            this.refreshTable();
        },

        handleConfigureColumns() {
            if (this.isTrashDisplayed) {
                return;
            }

            const $table = this.$refs.table as ComponentRef<typeof ServerTable>;
            $table?.showColumnsSelector();
        },

        handleFiltersChange(newFilters: Filters) {
            // - Recherche textuelle.
            const newSearch = mergeDifference(this.filters.search, newFilters.search);
            if (!isEqual(this.filters.search, newSearch)) {
                this.filters.search = newSearch;
            }

            // - Catégorie.
            if (this.filters.group !== newFilters.group) {
                this.filters.group = newFilters.group;
            }
        },

        handleFiltersSubmit() {
            this.refreshTable();
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        async fetch(pagination: SortableParams & PaginationParams) {
            pagination = pick(pagination, ['page', 'limit', 'ascending', 'orderBy']);
            this.isLoading = true;

            try {
                const data = await apiUsers.all({
                    ...pagination,
                    ...this.filters,
                    deleted: this.shouldDisplayTrashed,
                });
                this.isTrashDisplayed = this.shouldDisplayTrashed;
                return data;
            } catch (error) {
                if (error instanceof RequestError && error.httpCode === HttpCode.RangeNotSatisfiable) {
                    this.refreshTable();
                    return undefined;
                }

                // eslint-disable-next-line no-console
                console.error(`Error occurred while retrieving users:`, error);
                this.hasCriticalError = true;
            } finally {
                this.isLoading = false;
            }

            return undefined;
        },

        refreshTable() {
            this.refreshTableDebounced?.cancel();

            (this.$refs.table as ComponentRef<typeof ServerTable>)?.refresh();
        },
    },
    render() {
        const {
            $t: __,
            fetch,
            $options,
            filters,
            columns,
            isLoading,
            isTrashDisplayed,
            hasCriticalError,
            handleFiltersChange,
            handleFiltersSubmit,
            handleConfigureColumns,
            handleToggleShowTrashed,
        } = this;

        if (hasCriticalError) {
            return (
                <Page name="users" title={__('page.users.title')} centered>
                    <CriticalError />
                </Page>
            );
        }

        // - Titre de la page.
        const title = !isTrashDisplayed
            ? __('page.users.title')
            : __('page.users.title-trash');

        // - Actions de la page.
        const actions = !isTrashDisplayed
            ? [
                <Button type="add" icon="user-plus" to={{ name: 'add-user' }} collapsible>
                    {__('page.users.action-add')}
                </Button>,
                <Dropdown>
                    <Button icon="table" onClick={handleConfigureColumns}>
                        {__('configure-columns')}
                    </Button>
                    <Button icon="trash" onClick={handleToggleShowTrashed}>
                        {__('open-trash-bin')}
                    </Button>
                </Dropdown>,
            ]
            : [
                <Button onClick={handleToggleShowTrashed} icon="eye" type="primary">
                    {__('display-not-deleted-items')}
                </Button>,
            ];

        return (
            <Page
                name="users"
                title={title}
                loading={isLoading}
                actions={actions}
                scopedSlots={isTrashDisplayed ? undefined : {
                    headerContent: (): JSX.Node => (
                        <FiltersPanel
                            values={filters}
                            onChange={handleFiltersChange}
                            onSubmit={handleFiltersSubmit}
                        />
                    ),
                }}
            >
                <div class="Users">
                    <ServerTable
                        ref="table"
                        key={!isTrashDisplayed ? 'default' : 'trash'}
                        name={!isTrashDisplayed ? $options.name : undefined}
                        class="Users__table"
                        columns={columns}
                        fetcher={fetch}
                    />
                </div>
            </Page>
        );
    },
});

export default Users;
