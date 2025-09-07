import './index.scss';
import { defineComponent } from 'vue';
import apiSubcategories from '@/stores/api/subcategories';
import { confirm, prompt } from '@/utils/alert';
import Button from '@/themes/default/components/Button';
import Dropdown from '@/themes/default/components/Dropdown';

import type { PropType } from 'vue';
import type { CategoryDetails } from '@/stores/api/categories';
import type { SubCategory } from '@/stores/api/subcategories';

type Props = {
    /** La catégorie dans laquelle on souhaite ajouter les approbateurs. */
    category: CategoryDetails,

    /**
     * Fonction appelée lorsque l'utilisateur demande à modifier la catégorie.
     *
     * @param id - Identifiant de la catégorie.
     * @param previousName - Ancien nom de la catégorie.
     */
    onEditCategory?(id: CategoryDetails['id'], previousName: string): void,

    /**
     * Fonction appelée lorsque l'utilisateur demande à supprimer la catégorie.
     *
     * @param id - Identifiant de la catégorie supprimée.
     */
    onDeleteCategory?(id: CategoryDetails['id']): void,

    /**
     * Fonction appelée lorsqu'une sous-catégorie de la catégorie
     * a été modifiée.
     */
    onSubCategoryChange?(): void,
};

type Data = {
    isSaving: boolean,
};

/** Une catégorie affichée dans la liste des catégories. */
const CategoriesGlobalSettingsItem = defineComponent({
    name: 'CategoriesGlobalSettingsItem',
    props: {
        category: {
            type: Object as PropType<Props['category']>,
            required: true,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onEditCategory: {
            type: Function as PropType<Props['onEditCategory']>,
            default: undefined,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onDeleteCategory: {
            type: Function as PropType<Props['onDeleteCategory']>,
            default: undefined,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onSubCategoryChange: {
            type: Function as PropType<Props['onSubCategoryChange']>,
            default: undefined,
        },
    },
    emits: [
        'editCategory',
        'deleteCategory',
        'subCategoryChange',
    ],
    data: (): Data => ({
        isSaving: false,
    }),
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleEditCategory(previousName: string) {
            const { id } = this.category;
            this.$emit('editCategory', id, previousName);
        },

        handleRemoveCategory() {
            const { id } = this.category;
            this.$emit('deleteCategory', id);
        },

        async handleCreateSubCategory() {
            const name = await this.askForName(null);
            if (!name) {
                return;
            }
            this.saveSubCategory(null, name);
        },

        async handleEditSubCategory(id: CategoryDetails['id'], previousName: string | null) {
            const name = await this.askForName(previousName);
            if (!name) {
                return;
            }
            this.saveSubCategory(id, name);
        },

        async handleRemoveSubCategory(id: CategoryDetails['id']) {
            const { $t: __, isSaving } = this;
            if (isSaving) {
                return;
            }

            const isConfirmed = await confirm({
                type: 'danger',
                text: __('page.settings.categories.confirm-permanently-delete-subcategory'),
                confirmButtonText: __('yes-permanently-delete'),
            });
            if (!isConfirmed) {
                return;
            }

            this.isSaving = true;
            try {
                await apiSubcategories.remove(id);
                this.$emit('subCategoryChange');
                this.$toasted.success(__('page.settings.categories.subcategory-deleted'));
                this.$store.dispatch('categories/refresh');
            } catch {
                this.$toasted.error(__('errors.unexpected-while-deleting'));
            } finally {
                this.isSaving = false;
            }
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        async askForName(previousName: string | null = null): Promise<string | null> {
            const { $t: __, category } = this;
            const { name: categoryName, sub_categories: subCategories } = category;
            const isCreate = previousName === null;
            const title = isCreate
                ? __('page.settings.categories.new-subcategory', { categoryName })
                : __('page.settings.categories.modify-subcategory');

            // TODO: À migrer vers une vraie modale.
            //       (qui ne se ferme pas quand on a des erreurs de formulaire notamment)
            const { value } = await prompt(title, {
                placeholder: __('page.settings.categories.subcategory-name'),
                inputValue: isCreate ? undefined : previousName,
                confirmButtonText: isCreate ? __('page.settings.categories.create-subcategory') : undefined,
            });

            if (value === undefined || typeof value !== 'string') {
                return null;
            }

            if (value.length < 2 || value.length > 96) {
                this.$toasted.error(__('page.settings.categories.name-length-not-valid'));
                return this.askForName(value);
            }

            if (subCategories.some((subCategory: SubCategory) => subCategory.name === value)) {
                this.$toasted.error(__('page.settings.categories.subcategory-name-already-exists'));
                return this.askForName(value);
            }

            return value;
        },

        async saveSubCategory(id: SubCategory['id'] | null, name: SubCategory['name']) {
            const { $t: __, isSaving, category } = this;
            if (isSaving) {
                return;
            }

            const { id: categoryId } = category;

            const request = async (): Promise<void> => {
                if (id) {
                    await apiSubcategories.update(id, { name });
                } else {
                    await apiSubcategories.create({ name, category_id: categoryId });
                }
            };

            this.isSaving = true;
            try {
                await request();
                this.$emit('subCategoryChange');
                this.$toasted.success(__('page.settings.categories.subcategory-saved'));
                this.$store.dispatch('categories/refresh');
            } catch {
                this.$toasted.error(__('errors.unexpected-while-saving'));
            } finally {
                this.isSaving = false;
            }
        },
    },
    render() {
        const {
            $t: __,
            category,
            handleEditCategory,
            handleRemoveCategory,
            handleCreateSubCategory,
            handleEditSubCategory,
            handleRemoveSubCategory,
        } = this;

        const { id, name, sub_categories: subCategories } = category;

        return (
            <li class="CategoriesGlobalSettingsItem">
                <div class="CategoriesGlobalSettingsItem__category">
                    <div class="CategoriesGlobalSettingsItem__category__name">
                        {name}
                    </div>
                    <div class="CategoriesGlobalSettingsItem__category__actions">
                        <Button
                            type="add"
                            icon="folder-plus"
                            onClick={handleCreateSubCategory}
                            tooltip={__('page.settings.categories.add-a-subcategory')}
                        />
                        <Dropdown>
                            <Button
                                icon="list"
                                to={{
                                    name: 'materials',
                                    query: { category: id.toString() },
                                }}
                            >
                                {__('page.settings.categories.display-materials-list')}
                            </Button>
                            <Button
                                icon="edit"
                                type="default"
                                onClick={() => { handleEditCategory(name); }}
                            >
                                {__('page.settings.categories.modify')}
                            </Button>
                            <Button
                                type="delete"
                                onClick={() => { handleRemoveCategory(); }}
                            >
                                {__('page.settings.categories.delete')}
                            </Button>
                        </Dropdown>
                    </div>
                </div>
                <ul class="CategoriesGlobalSettingsItem__subcategories">
                    {subCategories.map(({ id: subCategoryId, name: subCategoryName }: SubCategory) => (
                        <li key={subCategoryId} class="CategoriesGlobalSettingsItem__subcategory">
                            <div class="CategoriesGlobalSettingsItem__subcategory__name">
                                {subCategoryName}
                            </div>
                            <div class="CategoriesGlobalSettingsItem__subcategory__actions">
                                <Dropdown>
                                    <Button
                                        to={{
                                            name: 'materials',
                                            query: {
                                                category: id.toString(),
                                                subCategory: subCategoryId.toString(),
                                            },
                                        }}
                                        icon="list"
                                    >
                                        {__('page.settings.categories.display-materials-list')}
                                    </Button>
                                    <Button
                                        type="primary"
                                        icon="edit"
                                        onClick={() => {
                                            handleEditSubCategory(subCategoryId, subCategoryName);
                                        }}
                                    >
                                        {__('page.settings.categories.modify-subcategory')}
                                    </Button>
                                    <Button
                                        type="delete"
                                        onClick={() => { handleRemoveSubCategory(subCategoryId); }}
                                    >
                                        {__('page.settings.categories.delete-subcategory')}
                                    </Button>
                                </Dropdown>
                            </div>
                        </li>
                    ))}
                </ul>
            </li>
        );
    },
});

export default CategoriesGlobalSettingsItem;
