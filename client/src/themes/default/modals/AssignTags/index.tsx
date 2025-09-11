import './index.scss';
import { defineComponent } from 'vue';
import Select from '@/themes/default/components/Select';
import Button from '@/themes/default/components/Button';

import type { Tag } from '@/stores/api/tags';
import type { PropType } from 'vue';
import type { Options } from '@/utils/formatOptions';

type Props = {
    /** Nom de l'entité associée aux tags. */
    name: string,

    /** Liste initiale des tags attribués à l'entité. */
    defaultTags?: Tag[],

    /**
     * Une méthode permettant de persister les tags sélectionnés.
     *
     * @param values - La liste des tags sélectionnés.
     */
    persister(values: Array<Tag['id']>): Promise<unknown>,
};

type Data = {
    values: Array<Tag['id']>,
    isSaving: boolean,
};

/** Modale permettant de sélectionner des tags. */
const AssignTags = defineComponent({
    name: 'AssignTags',
    modal: {
        width: 600,
        draggable: true,
        clickToClose: false,
    },
    props: {
        name: {
            type: String as PropType<Props['name']>,
            required: true,
        },
        defaultTags: {
            type: Array as PropType<Required<Props>['defaultTags']>,
            default: () => [],
        },
        persister: {
            type: Function as PropType<Props['persister']>,
            required: true,
        },
    },
    emits: ['saved', 'close'],
    data(): Data {
        return {
            values: this.defaultTags.map(({ id }: Tag) => id),
            isSaving: false,
        };
    },
    computed: {
        title(): string {
            const { __ } = this;

            return __('entity-name-tags', {
                entityName: this.name || '',
            });
        },

        tagsOptions(): Options<Tag> {
            return this.$store.getters['tags/options'];
        },
    },
    mounted() {
        this.$store.dispatch('tags/fetch');
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleSave() {
            this.save();
        },

        handleClose() {
            this.$emit('close');
        },

        handleRemoveAll() {
            this.values = [];
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

            const { __, values } = this;
            this.isSaving = true;

            try {
                await this.persister(values);

                this.$emit('saved');
                this.$emit('close');
            } catch {
                this.$toasted.error(__('global.errors.unexpected-while-saving'));
                this.isSaving = false;
            }
        },

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            key = !key.startsWith('global.')
                ? `modal.assign-tags.${key}`
                : key.replace(/^global\./, '');

            return this.$t(key, params, count);
        },
    },
    render() {
        const {
            __,
            title,
            tagsOptions,
            isSaving,
            handleSave,
            handleClose,
            handleRemoveAll,
        } = this;

        return (
            <div class="AssignTags">
                <header class="AssignTags__header">
                    <h2 class="AssignTags__header__title">{title}</h2>
                    <Button
                        type="close"
                        class="AssignTags__header__close-button"
                        onClick={handleClose}
                    />
                </header>
                <div class="AssignTags__body">
                    <p class="AssignTags__help">{__('choose-tags-below')}</p>
                    <div class="AssignTags__form">
                        <Select
                            value={this.values}
                            options={tagsOptions}
                            class="AssignTags__form__select"
                            onInput={(value: number[]) => {
                                this.values = value;
                            }}
                            multiple
                        />
                        <Button
                            type="danger"
                            icon="backspace"
                            tooltip={__('remove-all-tags')}
                            class="AssignTags__form__remove-all"
                            onClick={handleRemoveAll}
                        />
                    </div>
                </div>
                <div class="AssignTags__footer">
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

export default AssignTags;
