import './index.scss';
import trim from 'lodash/trim';
import { defineComponent } from 'vue';
import Textarea from '@/themes/default/components/Textarea';
import Button from '@/themes/default/components/Button';
import { VerticalFormKey } from '@/themes/default/components/@constants';

import type { ComponentRef, PropType } from 'vue';
import type { AwaitedMaterial } from '../../_types';

type Props = {
    /** Le matériel concerné par le commentaire. */
    material: AwaitedMaterial,

    /** La valeur par défaut (= valeur actuelle) du commentaire. */
    defaultValue?: string | null,

    /**
     * Fonction appelée lorsque l'utilisateur souhaite fermer la fenêtre modale.
     *
     * @param comment - Le commentaire saisi par l'utilisateur (`null` si le commentaire est vide).
     *                  (uniquement si l'utilisateur n'a pas fermé la modale sans modifier)
     */
    onClose?(comment: string | null | undefined): void,
};

type Data = {
    value: string,
};

/**
 * Fenêtre d'édition d'un commentaire dans
 * l'inventaire de matériel.
 */
const ModalInventoryCommentEdition = defineComponent({
    name: 'ModalInventoryCommentEdition',
    provide: {
        [VerticalFormKey as symbol]: true,
    },
    modal: {
        width: 800,
        dismissible: false,
    },
    props: {
        material: {
            type: Object as PropType<Props['material']>,
            required: true,
        },
        defaultValue: {
            type: String as PropType<Props['defaultValue']>,
            default: undefined,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onClose: {
            type: Function as PropType<Props['onClose']>,
            default: undefined,
        },
    },
    emits: ['close'],
    data(): Data {
        return {
            value: this.defaultValue ?? '',
        };
    },
    computed: {
        title(): string {
            const { __, material: { name } } = this;

            return __(`modal-title.material`, { name });
        },
    },
    mounted() {
        this.$nextTick(() => {
            const $input = this.$refs.input as ComponentRef<typeof Textarea>;
            $input?.focus();
        });
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleSubmit(e: Event) {
            e?.preventDefault();

            let value: string | null;
            value = trim(this.value);
            value = value && value.length > 0 ? value : null;

            this.$emit('close', value);
        },

        handleClose() {
            this.$emit('close', undefined);
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            key = !key.startsWith('global.')
                ? `components.Inventory.modals.comment-edition.${key}`
                : key.replace(/^global\./, '');

            return this.$t(key, params, count);
        },
    },
    render() {
        const { __, title, handleClose, handleSubmit } = this;

        return (
            <div class="ModalInventoryCommentEdition">
                <div class="ModalInventoryCommentEdition__header">
                    <h2 class="ModalInventoryCommentEdition__header__title">
                        {title}
                    </h2>
                    <Button
                        type="close"
                        class="ModalInventoryCommentEdition__header__close-button"
                        onClick={handleClose}
                    />
                </div>
                <div class="ModalInventoryCommentEdition__body">
                    <form class="ModalInventoryCommentEdition__form" onSubmit={handleSubmit}>
                        <Textarea
                            ref="input"
                            class="ModalInventoryCommentEdition__input"
                            rows={5}
                            value={this.value}
                            onInput={(value: string) => {
                                this.value = value;
                            }}
                        />
                    </form>
                </div>
                <div class="ModalInventoryCommentEdition__footer">
                    <Button type="primary" onClick={handleSubmit}>
                        {__('save-comment')}
                    </Button>
                </div>
            </div>
        );
    },
});

export default ModalInventoryCommentEdition;
