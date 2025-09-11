import './index.scss';
import { defineComponent } from 'vue';
import { confirm, prompt } from '@/utils/alert';
import apiCategories from '@/stores/api/categories';
import CriticalError from '@/themes/default/components/CriticalError';
import Loading from '@/themes/default/components/Loading';
import Button from '@/themes/default/components/Button';
import EmptyMessage from '@/themes/default/components/EmptyMessage';
import Item from './components/Item';
import SubPage from '../../components/SubPage';

import type { CategoryDetails } from '@/stores/api/categories';

type Data = {
    hasCriticalError: boolean,
    isFetching: boolean,
    isFetched: boolean,
    categories: CategoryDetails[],
};

/** Page des paramètres des catégories de matériel. */
const CategoriesGlobalSettings = defineComponent({
    name: 'CategoriesGlobalSettings',
    data: (): Data => ({
        hasCriticalError: false,
        isFetching: false,
        isFetched: false,
        categories: [],
    }),
    mounted() {
        this.fetchData();
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        async handleClickNewCategory() {
            const name = await this.askForName();
            if (!name) {
                return;
            }
            this.saveCategory(null, name);
        },

        async handleEditCategory(id: CategoryDetails['id'], previousName: string) {
            const name = await this.askForName(previousName);
            if (!name) {
                return;
            }
            this.saveCategory(id, name);
        },

        async handleDeleteCategory(id: CategoryDetails['id']) {
            const { __ } = this;
            const isConfirmed = await confirm({
                type: 'danger',
                text: __('confirm-permanently-delete'),
                confirmButtonText: __(`global.yes-permanently-delete`),
            });
            if (!isConfirmed) {
                return;
            }

            try {
                await apiCategories.remove(id);
                this.fetchData();
                this.$toasted.success(__('deleted'));
                this.$store.dispatch('categories/refresh');
            } catch {
                this.$toasted.error(__('global.errors.unexpected-while-deleting'));
            }
        },

        handleSubCategoryChange() {
            this.fetchData();
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        async fetchData() {
            if (this.isFetching) {
                return;
            }

            try {
                this.isFetching = true;
                this.categories = await apiCategories.all();
            } catch {
                this.hasCriticalError = true;
            } finally {
                this.isFetching = false;
                this.isFetched = true;
            }
        },

        async askForName(previousName: string | null = null): Promise<string | null> {
            const { __ } = this;
            const isCreate = previousName === null;
            const title = isCreate ? __('create') : __('modify');

            // TODO: À migrer vers une vraie modale.
            //       (qui ne se ferme pas quand on a des erreurs de formulaire notamment)
            const { value } = await prompt(title, {
                placeholder: __('category-name'),
                inputValue: isCreate ? undefined : previousName,
                confirmButtonText: isCreate ? __('create') : undefined,
            });

            if (value === undefined || typeof value !== 'string') {
                return null;
            }

            if (value.length < 2 || value.length > 96) {
                this.$toasted.error(__('name-length-not-valid'));
                return this.askForName(value);
            }

            if (this.categories.some((category: CategoryDetails) => category.name === value)) {
                this.$toasted.error(__('name-already-exists'));
                return this.askForName(value);
            }

            return value;
        },

        async saveCategory(id: CategoryDetails['id'] | null, name: CategoryDetails['name']) {
            const { __ } = this;

            const request = async (): Promise<void> => {
                if (id) {
                    await apiCategories.update(id, { name });
                } else {
                    await apiCategories.create({ name });
                }
            };

            try {
                await request();
                this.fetchData();
                this.$toasted.success(__('saved'));
                this.$store.dispatch('categories/refresh');
            } catch {
                this.$toasted.error(__('global.errors.unexpected-while-saving'));
            }
        },

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            key = !key.startsWith('global.')
                ? `page.settings.categories.${key}`
                : key.replace(/^global\./, '');

            return this.$t(key, params, count);
        },
    },
    render() {
        const {
            __,
            hasCriticalError,
            isFetched,
            categories,
            handleClickNewCategory,
            handleEditCategory,
            handleDeleteCategory,
            handleSubCategoryChange,
        } = this;

        if (hasCriticalError || !isFetched) {
            return (
                <SubPage
                    class="CategoriesGlobalSettings"
                    title={__('title')}
                    help={__('help')}
                    centered
                >
                    {hasCriticalError ? <CriticalError /> : <Loading />}
                </SubPage>
            );
        }

        if (categories.length === 0) {
            return (
                <SubPage
                    class="CategoriesGlobalSettings"
                    title={__('title')}
                    help={__('help')}
                    centered
                >
                    <EmptyMessage
                        message={__('no-category-yet')}
                        action={{
                            type: 'add',
                            label: __('create-a-first-category'),
                            onClick: handleClickNewCategory,
                        }}
                    />
                </SubPage>
            );
        }

        return (
            <SubPage
                class="CategoriesGlobalSettings"
                title={__('title')}
                help={__('help')}
                actions={[
                    <Button
                        type="add"
                        class="CategoriesGlobalSettings__create"
                        onClick={handleClickNewCategory}
                        collapsible
                    >
                        {__('new-category')}
                    </Button>,
                ]}
            >
                <ul class="CategoriesGlobalSettings__list">
                    {categories.map((category: CategoryDetails) => (
                        <Item
                            key={category.id}
                            class="CategoriesGlobalSettings__item"
                            category={category}
                            onEditCategory={handleEditCategory}
                            onDeleteCategory={handleDeleteCategory}
                            onSubCategoryChange={handleSubCategoryChange}
                        />
                    ))}
                </ul>
            </SubPage>
        );
    },
});

export default CategoriesGlobalSettings;
