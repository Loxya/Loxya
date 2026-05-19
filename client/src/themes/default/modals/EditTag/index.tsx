import './index.scss';
import { RequestError } from '@/globals/requester';
import { defineComponent } from 'vue';
import { ApiErrorCode } from '@/stores/api/@codes';
import apiTags from '@/stores/api/tags';
import FormField from '@/themes/default/components/FormField';
import { VerticalFormKey } from '@/themes/default/components/@constants';
import Button from '@/themes/default/components/Button';

import type { ComponentRef, PropType } from 'vue';
import type { Tag, TagEdit } from '@/stores/api/tags';

type Props = {
    /**
     * Le tag à modifier.
     * Si non fourni, on considérera que c'est un ajout.
     */
    tag?: Tag,

    /**
     * Fonction appelée lorsque la modale est fermée.
     *
     * @param updatedTag - Le tag sauvegardé si la modification a été menée à son terme.
     */
    onClose?(updatedTag?: Tag): void,
};

type Data = {
    name: TagEdit['name'],
    isSaving: boolean,
    validationErrors: Record<string, string> | null,
};

/** Modale permettant de créer ou modifier un tag. */
const EditTag = defineComponent({
    name: 'EditTag',
    provide: {
        [VerticalFormKey as symbol]: true,
    },
    modal: {
        width: 600,
        dismissible: false,
    },
    props: {
        tag: {
            type: Object as PropType<Props['tag']>,
            default: undefined,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onClose: {
            type: Function as PropType<Props['onClose']>,
            default: undefined,
        },
    },
    emits: ['saved', 'close'],
    data(): Data {
        return {
            name: this.tag?.name ?? '',
            isSaving: false,
            validationErrors: null,
        };
    },
    computed: {
        isNew(): boolean {
            return this.tag === undefined;
        },

        title(): string {
            const { __, isNew } = this;

            return isNew
                ? __('title-create')
                : __('title-edit');
        },
    },
    mounted() {
        if (this.isNew) {
            this.$nextTick(() => {
                const $inputName = this.$refs.inputName as ComponentRef<typeof FormField>;
                $inputName?.focus();
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
            const { __, tag, name } = this;

            try {
                const updatedTag = tag === undefined
                    ? await apiTags.create({ name })
                    : await apiTags.update(tag.id, { name });

                this.$store.dispatch('tags/refresh');

                this.$emit('saved');
                this.$emit('close', updatedTag);
            } catch (error) {
                this.isSaving = false;

                if (error instanceof RequestError && error.code === ApiErrorCode.VALIDATION_FAILED) {
                    this.validationErrors = { ...error.details };
                    return;
                }

                // eslint-disable-next-line no-console
                console.error(`Error occurred while saving the tag`, error);
                this.$toasted.error(__('global.errors.unexpected-while-saving'));
            }
        },

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            key = !key.startsWith('global.')
                ? `modal.edit-tag.${key}`
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
            <div class="EditTag">
                <header class="EditTag__header">
                    <h2 class="EditTag__header__title">{title}</h2>
                    <Button
                        type="close"
                        class="EditTag__header__close-button"
                        onClick={handleClose}
                    />
                </header>
                <div class="EditTag__body">
                    <form class="EditTag__form" onSubmit={handleSubmit}>
                        <FormField
                            type="text"
                            ref="inputName"
                            label={__('tag-name')}
                            class="EditTag__form__input-name"
                            value={this.name}
                            error={validationErrors?.name}
                            onInput={(value: string) => {
                                this.name = value;
                            }}
                            required
                        />
                    </form>
                </div>
                <div class="EditTag__footer">
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

export default EditTag;
