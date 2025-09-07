import './index.scss';
import isEqual from 'lodash/isEqual';
import { confirm } from '@/utils/alert';
import stringIncludes from '@/utils/stringIncludes';
import mergeDifference from '@/utils/mergeDifference';
import { defineComponent } from 'vue';
import { CustomFieldType } from '@/stores/api/@types';
import apiProperties from '@/stores/api/properties';
import Page from '@/themes/default/components/Page';
import CriticalError from '@/themes/default/components/CriticalError';
import ClientTable from '@/themes/default/components/Table/Client';
import Dropdown from '@/themes/default/components/Dropdown';
import Loading from '@/themes/default/components/Loading';
import Button from '@/themes/default/components/Button';
import FiltersPanel, { FiltersSchema } from './components/Filters';
import {
    persistFilters,
    getPersistedFilters,
    clearPersistedFilters,
} from '@/utils/filtersPersister';

import type { Filters } from './components/Filters';
import type { ComponentRef, CreateElement } from 'vue';
import type { Category } from '@/stores/api/categories';
import type { PropertyDetails as Property, PropertyEntity } from '@/stores/api/properties';
import type { Columns } from '@/themes/default/components/Table/Client';
import type { Session } from '@/stores/api/session';

type Data = {
    filters: Filters,
    isDeleting: boolean,
    isFetched: boolean,
    hasCriticalError: boolean,
    properties: Property[],
};

/** La clé utilisé pour la persistence des filtres de la page. */
const FILTERS_PERSISTENCE_KEY = 'Properties--filters';

/** Page de listing des caractéristiques spéciales de matériel. */
const Properties = defineComponent({
    name: 'Properties',
    data(): Data {
        const filters: Filters = {
            search: [],
        };

        // - Filtres sauvegardés.
        const session = this.$store.state.auth.user as Session;
        if (!session.disable_search_persistence) {
            const savedFilters = getPersistedFilters(FILTERS_PERSISTENCE_KEY, FiltersSchema);
            Object.assign(filters, savedFilters ?? {});
        } else {
            clearPersistedFilters(FILTERS_PERSISTENCE_KEY);
        }

        return {
            isDeleting: false,
            isFetched: false,
            hasCriticalError: false,
            properties: [],
            filters,
        };
    },
    computed: {
        shouldPersistSearch(): boolean {
            const session = this.$store.state.auth.user as Session;
            return !session.disable_search_persistence;
        },

        filteredProperties(): Property[] {
            const { filters, properties } = this;

            // - Recherche textuelle.
            const search = filters.search.filter(
                (term: string) => term.trim().length > 1,
            );
            if (search.length === 0) {
                return properties;
            }

            return this.properties.filter((property: Property): boolean => (
                search.some((term: string) => stringIncludes(property.name, term))
            ));
        },

        columns(): Columns<Property> {
            const { __, handleDeleteItemClick } = this;

            return [
                {
                    key: 'name',
                    title: __('columns.name'),
                    sortable: true,
                    class: [
                        'Properties__table__cell',
                        'Properties__table__cell--name',
                    ],
                    render: (h: CreateElement, { name }: Property) => (
                        <div class="Properties__item__name">
                            {name}
                        </div>
                    ),
                },
                {
                    key: 'entities',
                    title: __('columns.entities'),
                    class: [
                        'Properties__table__cell',
                        'Properties__table__cell--entities',
                    ],
                    render: (h: CreateElement, property: Property) => (
                        property.entities
                            .map((entity: PropertyEntity) => (
                                __(`entities.${entity}`)
                            ))
                            .join(', ')
                    ),
                },
                {
                    key: 'type',
                    title: __('columns.type'),
                    sortable: true,
                    class: [
                        'Properties__table__cell',
                        'Properties__table__cell--type',
                    ],
                    render: (h: CreateElement, property: Property) => {
                        const configs: Array<{ label: string, value: string }> = [];

                        switch (property.type) {
                            case CustomFieldType.INTEGER:
                            case CustomFieldType.FLOAT: {
                                if (property.unit !== null) {
                                    configs.push({ label: __('config.unit'), value: property.unit });
                                }
                                break;
                            }

                            case CustomFieldType.STRING: {
                                if (property.max_length !== null) {
                                    configs.push({
                                        label: __('config.max-length.label'),
                                        value: __(
                                            'config.max-length.value',
                                            { count: property.max_length.toString() },
                                            property.max_length,
                                        ),
                                    });
                                }
                                break;
                            }

                            case CustomFieldType.PERIOD: {
                                configs.push({
                                    label: __('config.period-precision.label'),
                                    value: (() => {
                                        if (property.full_days === null) {
                                            return __('config.period-precision.value.free');
                                        }

                                        return property.full_days
                                            ? __('config.period-precision.value.daily')
                                            : __('config.period-precision.value.hourly');
                                    })(),
                                });
                                break;
                            }

                            case CustomFieldType.LIST: {
                                if (property.options.length > 0) {
                                    configs.push({
                                        label: __('config.list-choices'),
                                        value: property.options.length > 5
                                            ? `${property.options.slice(0, 5).join(', ')}, ...`
                                            : property.options.join(', '),
                                    });
                                }
                                break;
                            }

                            // - No default.
                        }

                        return (
                            <div class="Properties__item__type">
                                <span class="Properties__item__type__type">
                                    {__(`types.${property.type}`)}
                                </span>
                                {configs.length > 0 && (
                                    <dl class="Properties__item__type__configs">
                                        {configs.map(({ label, value }: { label: string, value: string }) => (
                                            <div class="Properties__item__type__configs__item">
                                                <dt class="Properties__item__type__configs__item__key">
                                                    {label}
                                                </dt>
                                                <dd class="Properties__item__type__configs__item__value">
                                                    {value}
                                                </dd>
                                            </div>
                                        ))}
                                    </dl>
                                )}
                            </div>
                        );
                    },
                },
                {
                    key: 'is-totalisable',
                    title: __('columns.is-totalisable'),
                    class: [
                        'Properties__table__cell',
                        'Properties__table__cell--is-totalisable',
                    ],
                    render: (h: CreateElement, property: Property) => (
                        property.type === CustomFieldType.INTEGER || property.type === CustomFieldType.FLOAT
                            ? (property.is_totalisable ? __('global.yes') : __('global.no'))
                            : __('global.no')
                    ),
                },
                {
                    key: 'categories',
                    title: __('columns.limited-to-categories'),
                    class: [
                        'Properties__table__cell',
                        'Properties__table__cell--categories',
                    ],
                    render: (h: CreateElement, { categories }: Property) => (
                        <div
                            class={['Properties__item__categories', {
                                'Properties__item__categories--empty': categories.length === 0,
                            }]}
                        >
                            {(
                                categories.length > 0
                                    ? categories.map(({ name: _name }: Category) => _name).join(', ')
                                    : __('all-categories-not-limited')
                            )}
                        </div>
                    ),
                },
                {
                    key: 'actions',
                    class: [
                        'Properties__table__cell',
                        'Properties__table__cell--actions',
                    ],
                    render: (h: CreateElement, { id }: Property) => (
                        <Dropdown>
                            <Button
                                type="edit"
                                to={{
                                    name: 'edit-property',
                                    params: { id: id.toString() },
                                }}
                            >
                                {__('global.action-edit')}
                            </Button>
                            <Button
                                type="trash"
                                onClick={(e: MouseEvent) => {
                                    handleDeleteItemClick(e, id);
                                }}
                            >
                                {__('global.action-delete')}
                            </Button>
                        </Dropdown>
                    ),
                },
            ];
        },
    },
    watch: {
        filters: {
            handler() {
                if (this.shouldPersistSearch) {
                    persistFilters(FILTERS_PERSISTENCE_KEY, this.filters);
                }
            },
            deep: true,
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

        async handleDeleteItemClick(e: MouseEvent, id: Property['id']) {
            e.stopPropagation();

            if (this.isDeleting) {
                return;
            }

            const { __ } = this;

            // eslint-disable-next-line no-restricted-syntax
            for (const index of [1, 2]) {
                // eslint-disable-next-line no-await-in-loop
                const isConfirmed = await confirm({
                    type: 'danger',
                    text: __(`confirm-permanently-delete.${index}`),
                    confirmButtonText: __('global.yes-permanently-delete'),
                });
                if (!isConfirmed) {
                    return;
                }
            }

            this.isDeleting = true;
            try {
                await apiProperties.remove(id);

                const index = this.properties.findIndex(
                    ({ id: _id }: Property) => _id === id,
                );
                if (index === -1) {
                    this.fetchData();
                    return;
                }

                this.properties.splice(index, 1);
                this.$toasted.success(__('deleted'));
            } catch {
                this.$toasted.error(__('global.errors.unexpected-while-deleting'));
            } finally {
                this.isDeleting = false;
            }
        },

        handleConfigureColumns() {
            const $table = this.$refs.table as ComponentRef<typeof ClientTable>;
            $table?.showColumnsSelector();
        },

        handleFiltersChange(newFilters: Filters) {
            // - Recherche textuelle.
            const newSearch = mergeDifference(this.filters.search, newFilters.search);
            if (!isEqual(this.filters.search, newSearch)) {
                this.filters.search = newSearch;
            }
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        async fetchData() {
            try {
                this.properties = await apiProperties.all();
                this.isFetched = true;
            } catch {
                this.hasCriticalError = true;
            }
        },

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            key = !key.startsWith('global.')
                ? `page.properties.${key}`
                : key.replace(/^global\./, '');

            return this.$t(key, params, count);
        },
    },
    render() {
        const {
            __,
            filters,
            columns,
            $options,
            isFetched,
            isDeleting,
            filteredProperties,
            hasCriticalError,
            handleFiltersChange,
            handleConfigureColumns,
        } = this;

        if (hasCriticalError || !isFetched) {
            return (
                <Page name="properties" title={__('title')} centered>
                    {hasCriticalError ? <CriticalError /> : <Loading />}
                </Page>
            );
        }

        return (
            <Page
                name="properties"
                loading={isDeleting}
                title={__('title')}
                actions={[
                    <Button type="add" to={{ name: 'add-property' }} collapsible>
                        {__('add-btn')}
                    </Button>,
                    <Dropdown>
                        <Button icon="table" onClick={handleConfigureColumns}>
                            {__('global.configure-columns')}
                        </Button>
                    </Dropdown>,
                ]}
                scopedSlots={{
                    headerContent: (): JSX.Node => (
                        <FiltersPanel
                            values={filters}
                            onChange={handleFiltersChange}
                        />
                    ),
                }}
            >
                <div class="Properties">
                    <ClientTable
                        ref="table"
                        name={$options.name}
                        class="Properties__table"
                        columns={columns}
                        data={filteredProperties}
                        defaultOrderBy="name"
                    />
                </div>
            </Page>
        );
    },
});

export default Properties;
