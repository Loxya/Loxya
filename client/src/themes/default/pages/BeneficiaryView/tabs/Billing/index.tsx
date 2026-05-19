import './index.scss';
import { defineComponent } from 'vue';
import CriticalError, { ErrorType } from '@/themes/default/components/CriticalError';
import Invoices from './Invoices';
import Estimates from './Estimates';

import type { ComponentRef, PropType } from 'vue';
import type { BeneficiaryDetails } from '@/stores/api/beneficiaries';

type Props = {
    /** Le bénéficiaire dont on veut afficher les devis et factures. */
    beneficiary: BeneficiaryDetails,
};

type Data = {
    hasCriticalError: boolean,
};

/**
 * Contenu de l'onglet "devis & factures" de la
 * page de détails d'un bénéficiaire.
 */
const BeneficiaryViewBilling = defineComponent({
    name: 'BeneficiaryViewBilling',
    props: {
        beneficiary: {
            type: Object as PropType<Props['beneficiary']>,
            required: true,
        },
    },
    data: (): Data => ({
        hasCriticalError: false,
    }),
    errorCaptured() {
        this.hasCriticalError = true;
        return false;
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleRefetchNeeded(from: 'invoices' | 'estimates') {
            const $other = from === 'invoices'
                ? this.$refs.estimates as ComponentRef<typeof Estimates>
                : this.$refs.invoices as ComponentRef<typeof Invoices>;

            $other?.refresh();
        },
    },
    render() {
        const { beneficiary, hasCriticalError, handleRefetchNeeded } = this;

        if (hasCriticalError) {
            return (
                <div
                    class={[
                        'BeneficiaryViewBilling',
                        'BeneficiaryViewBilling--error',
                    ]}
                >
                    <CriticalError type={ErrorType.UNKNOWN} />
                </div>
            );
        }

        return (
            <div class="BeneficiaryViewBilling">
                <div class="BeneficiaryViewBilling__invoices">
                    <Invoices
                        ref="invoices"
                        beneficiary={beneficiary}
                        onRefetchNeeded={() => { handleRefetchNeeded('invoices'); }}
                    />
                </div>
                <div class="BeneficiaryViewBilling__estimates">
                    <Estimates
                        ref="estimates"
                        beneficiary={beneficiary}
                        onRefetchNeeded={() => { handleRefetchNeeded('estimates'); }}
                    />
                </div>
            </div>
        );
    },
});

export default BeneficiaryViewBilling;
