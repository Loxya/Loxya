import './index.scss';
import { defineComponent } from 'vue';
import apiTags from '@/stores/api/tags';
import { confirm } from '@/utils/alert';
import showModal from '@/utils/showModal';
import stringCompare from '@/utils/stringCompare';
import CriticalError from '@/themes/default/components/CriticalError';
import Loading from '@/themes/default/components/Loading';
import EmptyMessage from '@/themes/default/components/EmptyMessage';
import Dropdown from '@/themes/default/components/Dropdown';
import Button from '@/themes/default/components/Button';
import Icon from '@/themes/default/components/Icon';
import SubPage from '../../components/SubPage';

// - Modales
import EditTag from '@/themes/default/modals/EditTag';

import type { Tag } from '@/stores/api/tags';

type Data = {
    tags: Tag[],
    isFetched: boolean,
    processing: Array<Tag['id']>,
    hasCriticalError: boolean,
    shouldDisplayTrashed: boolean,
    isTrashDisplayed: boolean,
};

/** Page des paramètres des tags du matériel. */
const TagsGlobalSettings = defineComponent({
    name: 'TagsGlobalSettings',
    data: (): Data => ({
        tags: [],
        isFetched: false,
        processing: [],
        hasCriticalError: false,
        shouldDisplayTrashed: false,
        isTrashDisplayed: false,
    }),
    computed: {
        sortedTags(): Tag[] {
            const { tags } = this;
            return [...tags].sort((a: Tag, b: Tag) => (
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
            const newTag: Tag | undefined = (
                await showModal(this.$modal, EditTag)
            );

            // - Si l'ajout a été annulé, on retourne sans autre.
            if (newTag === undefined) {
                return;
            }

            const { __ } = this;
            this.$toasted.success(__('saved'));

            this.tags.push(newTag);
            this.fetchData();
        },

        async handleEdit(id: Tag['id']) {
            const tag = this.tags.find((_tag: Tag) => _tag.id === id);
            if (this.processing.includes(id) || tag === undefined) {
                return;
            }
            this.processing.push(id);

            const updatedTag: Tag | undefined = (
                await showModal(this.$modal, EditTag, { tag })
            );

            this.$delete(this.processing, this.processing.indexOf(id));

            // - Si l'édition a été annulée, on retourne sans autre.
            if (updatedTag === undefined) {
                return;
            }

            const { __ } = this;
            this.$toasted.success(__('saved'));

            const toUpdateIndex = this.tags.findIndex((_tag: Tag) => _tag.id === id);
            this.$set(this.tags, toUpdateIndex, updatedTag);
            this.fetchData();
        },

        async handleRemove(id: Tag['id']) {
            const tag = this.tags.find((_tag: Tag) => _tag.id === id);
            if (this.processing.includes(id) || tag === undefined) {
                return;
            }
            this.processing.push(id);

            const { __, isTrashDisplayed } = this;
            const isSoft = !isTrashDisplayed;

            const isConfirmed = await confirm({
                type: 'danger',
                text: isSoft
                    ? __('confirm-delete')
                    : __('confirm-permanently-delete'),
                confirmButtonText: isSoft
                    ? __('global.yes-trash')
                    : __('global.yes-permanently-delete'),
            });
            if (!isConfirmed) {
                this.$delete(this.processing, this.processing.indexOf(id));
                return;
            }

            // Note: On utilise pas `this.tags.indexOf(tag)` car la liste a
            //       pu changer depuis (vu le await plus haut).
            const index = this.tags.findIndex((_tag: Tag) => _tag.id === id);
            if (index !== -1) {
                this.$delete(this.tags, index);
            }

            try {
                await apiTags.remove(id);
                this.$toasted.success(__('deleted'));
                this.$store.dispatch('tags/refresh');
            } catch {
                this.$toasted.error(__('global.errors.unexpected-while-deleting'));
                this.fetchData();
            } finally {
                this.$delete(this.processing, this.processing.indexOf(id));
            }
        },

        async handleRestore(id: Tag['id']) {
            const tag = this.tags.find((_tag: Tag) => _tag.id === id);
            if (this.processing.includes(id) || tag === undefined) {
                return;
            }
            this.processing.push(id);

            const { __ } = this;
            const isConfirmed = await confirm({
                text: __('confirm-restore'),
                confirmButtonText: __('global.yes-restore'),
            });
            if (!isConfirmed) {
                this.$delete(this.processing, this.processing.indexOf(id));
                return;
            }

            // Note: On utilise pas `this.tags.indexOf(tag)` car la liste a
            //       pu changer depuis (vu le await plus haut).
            const index = this.tags.findIndex((_tag: Tag) => _tag.id === id);
            if (index !== -1) {
                this.$delete(this.tags, index);
            }

            try {
                await apiTags.restore(id);
                this.$toasted.success(__('restored'));
                this.$store.dispatch('tags/refresh');
            } catch {
                this.$toasted.error(__('global.errors.unexpected-while-restoring'));
                this.fetchData();
            } finally {
                this.$delete(this.processing, this.processing.indexOf(id));
            }
        },

        handleToggleShowTrashed() {
            this.shouldDisplayTrashed = !this.shouldDisplayTrashed;
            this.fetchData();
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        async fetchData() {
            try {
                const deleted = this.shouldDisplayTrashed;
                const data = await apiTags.all({ deleted });
                this.tags = data;
                this.isTrashDisplayed = this.shouldDisplayTrashed;
                this.isFetched = true;
            } catch {
                this.hasCriticalError = true;
            }
        },

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            key = !key.startsWith('global.')
                ? `page.settings.tags.${key}`
                : key.replace(/^global\./, '');

            return this.$t(key, params, count);
        },
    },
    render() {
        const {
            __,
            sortedTags,
            isFetched,
            processing,
            hasCriticalError,
            isTrashDisplayed,
            handleCreate,
            handleEdit,
            handleRemove,
            handleRestore,
            handleToggleShowTrashed,
        } = this;

        // - Titre de la page.
        const title = !isTrashDisplayed
            ? __('title')
            : __('title-trash');

        // - Aide de page.
        const help = !isTrashDisplayed
            ? __('help')
            : undefined;

        if (hasCriticalError || !isFetched) {
            return (
                <SubPage class="TagsGlobalSettings" title={title} help={help} centered>
                    {hasCriticalError ? <CriticalError /> : <Loading />}
                </SubPage>
            );
        }

        // - Actions de la page.
        const actions = !isTrashDisplayed
            ? [
                <Button type="add" onClick={handleCreate} collapsible>
                    {__('action-add')}
                </Button>,
                <Dropdown>
                    <Button icon="trash" onClick={handleToggleShowTrashed}>
                        {__('global.open-trash-bin')}
                    </Button>
                </Dropdown>,
            ]
            : [
                <Button onClick={handleToggleShowTrashed} icon="eye" type="primary">
                    {__('global.display-not-deleted-items')}
                </Button>,
            ];

        if (sortedTags.length === 0) {
            return (
                <SubPage
                    class="TagsGlobalSettings"
                    title={title}
                    help={help}
                    actions={actions}
                    centered
                >
                    <EmptyMessage
                        message={(
                            isTrashDisplayed
                                ? __('no-tag-in-trash')
                                : __('no-tag-yet')
                        )}
                        action={(
                            isTrashDisplayed
                                ? {
                                    type: 'primary',
                                    label: __('global.display-not-deleted-items'),
                                    onClick: handleToggleShowTrashed,
                                }
                                : {
                                    type: 'add',
                                    label: __('create-first-tag'),
                                    onClick: handleCreate,
                                }
                        )}
                    />
                </SubPage>
            );
        }

        return (
            <SubPage
                class="TagsGlobalSettings"
                title={title}
                help={help}
                actions={actions}
            >
                <ul class="TagsGlobalSettings__list">
                    {sortedTags.map(({ id, name }: Tag) => (
                        <li key={id} class="TagsGlobalSettings__item">
                            <span class="TagsGlobalSettings__item__name">
                                {(
                                    processing.includes(id)
                                        ? <Icon name="circle-notch" spin />
                                        : <Icon name="tag" />
                                )}
                                {name}
                            </span>
                            {!isTrashDisplayed && (
                                <span class="TagsGlobalSettings__item__actions">
                                    <Button
                                        type="edit"
                                        onClick={() => { handleEdit(id); }}
                                        disabled={processing.includes(id)}
                                    />
                                    <Button
                                        type="trash"
                                        onClick={() => { handleRemove(id); }}
                                        disabled={processing.includes(id)}
                                    />
                                </span>
                            )}
                            {isTrashDisplayed && (
                                <span class="TagsGlobalSettings__item__actions">
                                    <Button
                                        type="restore"
                                        onClick={() => { handleRestore(id); }}
                                        disabled={processing.includes(id)}
                                    />
                                    <Button
                                        type="delete"
                                        onClick={() => { handleRemove(id); }}
                                        disabled={processing.includes(id)}
                                    />
                                </span>
                            )}
                        </li>
                    ))}
                </ul>
            </SubPage>
        );
    },
});

export default TagsGlobalSettings;
