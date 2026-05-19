import './index.scss';
import config from '@/globals/config';
import Country from '@/utils/country';
import { defineComponent } from 'vue';
import Button from '@/themes/default/components/Button';

import type { PropType } from 'vue';
import type TaxRegime from '@/utils/invoicing/tax-regime';
import type VatExemptionCode from '@/utils/invoicing/vat-exemption-code';

type Props = {
    /** Le régime de taxe pour lequel on choisit un code d'exemption. */
    regime: Exclude<TaxRegime, TaxRegime.STANDARD>,

    /**
     * Fonction appelée lorsque l'utilisateur souhaite fermer la fenêtre modale.
     *
     * @param selectedCode - Le code d'exemption sélectionné (`null` pour "Sans motif"),
     *                       ou `undefined` si la modale a été fermée sans sélection.
     */
    onClose?(selectedCode?: VatExemptionCode | null): void,
};

/** Fenêtre modale de sélection du motif d'exemption de T.V.A. */
const BillingEditorSelectExemptionCodeModal = defineComponent({
    name: 'BillingEditorSelectExemptionCodeModal',
    modal: {
        width: 500,
        dismissible: true,
    },
    props: {
        regime: {
            type: String as unknown as PropType<Props['regime']>,
            required: true,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onClose: {
            type: Function as PropType<Props['onClose']>,
            default: undefined,
        },
    },
    emits: ['close'],
    computed: {
        availableCodes(): VatExemptionCode[] {
            const orgCountry = new Country(config.organization.country);
            return orgCountry.getLineAvailableTaxExemptionCodes(this.regime);
        },
    },
    mounted() {
        if (this.availableCodes.length === 0) {
            this.$emit('close', null);
        }
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleSelect(code: VatExemptionCode | null) {
            this.$emit('close', code);
        },

        handleClose() {
            this.$emit('close');
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            key = !key.startsWith('global.')
                ? `components.BillingEditor.modals.select-exemption-code.${key}`
                : key.replace(/^global\./, '');

            return this.$t(key, params, count);
        },
    },
    render() {
        const {
            __,
            availableCodes,
            handleSelect,
            handleClose,
        } = this;

        return (
            <div class="BillingEditorSelectExemptionCodeModal">
                <div class="BillingEditorSelectExemptionCodeModal__header">
                    <div class="BillingEditorSelectExemptionCodeModal__header__heading">
                        <h2 class="BillingEditorSelectExemptionCodeModal__header__heading__title">
                            {__('title')}
                        </h2>
                        <p class="BillingEditorSelectExemptionCodeModal__header__heading__description">
                            {__('description')}
                        </p>
                    </div>
                    <Button
                        type="close"
                        class="BillingEditorSelectExemptionCodeModal__header__close-button"
                        onClick={handleClose}
                    />
                </div>
                <div class="BillingEditorSelectExemptionCodeModal__body">
                    <ul class="BillingEditorSelectExemptionCodeModal__list">
                        <li
                            class="BillingEditorSelectExemptionCodeModal__list__item"
                            onClick={() => { handleSelect(null); }}
                        >
                            <span class="BillingEditorSelectExemptionCodeModal__list__item__label">
                                {__('no-reason')}
                            </span>
                        </li>
                        {availableCodes.map((code: VatExemptionCode) => (
                            <li
                                key={code}
                                class="BillingEditorSelectExemptionCodeModal__list__item"
                                onClick={() => { handleSelect(code); }}
                            >
                                <span class="BillingEditorSelectExemptionCodeModal__list__item__label">
                                    {__(`global.vat-exemptions.${code}.label`)}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        );
    },
});

export default BillingEditorSelectExemptionCodeModal;
