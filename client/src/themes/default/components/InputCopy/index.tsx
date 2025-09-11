import './index.scss';
import { defineComponent } from 'vue';
import Button from '@/themes/default/components/Button';

import type { PropType } from 'vue';

type Props = {
    /** La valeur qui doit être proposée à la copie. */
    value: string | number,
};

type Data = {
    isCopied: boolean,
};

/** Un champ de formulaire permettant de copier une valeur. */
const InputCopy = defineComponent({
    name: 'InputCopy',
    props: {
        value: {
            type: [String, Number] as PropType<Required<Props>['value']>,
            required: true,
        },
    },
    data: (): Data => ({
        isCopied: false,
    }),
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleFocus() {
            this.selectInputContent();
        },

        handleCopy() {
            const cancelSelection = this.selectInputContent();
            if (!document.execCommand('copy')) {
                return;
            }
            cancelSelection();

            // - Affiche l'état "Copié !" et le revert au bout de 2 secondes.
            setTimeout(() => { this.isCopied = false; }, 2000);
            this.isCopied = true;
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        selectInputContent() {
            const $input = this.$refs.input as HTMLInputElement | undefined;

            $input?.select();

            return () => {
                $input?.blur();

                // - Requis pour Chrome qui ne prend pas en compte le `blur`.
                window.getSelection()?.removeAllRanges();
            };
        },
    },
    render() {
        const {
            $t: __,
            value,
            isCopied,
            handleCopy,
            handleFocus,
        } = this;

        return (
            <div class="InputCopy">
                <input
                    ref="input"
                    class="InputCopy__input"
                    type="text"
                    value={value}
                    onFocus={handleFocus}
                    readonly
                />
                <div class="InputCopy__button-wrapper">
                    <Button class="InputCopy__button" onClick={handleCopy}>
                        {isCopied ? __('copied') : __('copy')}
                    </Button>
                </div>
            </div>
        );
    },
});

export default InputCopy;
