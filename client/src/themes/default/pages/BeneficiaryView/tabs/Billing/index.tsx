import './index.scss';
import { defineComponent } from 'vue';
import apiBeneficiaries from '@/stores/api/beneficiaries';
import CriticalError, { ErrorType } from '@/themes/default/components/CriticalError';
import Loading from '@/themes/default/components/Loading';
import EmptyMessage from '@/themes/default/components/EmptyMessage';
import Invoices from './Invoices';
import Estimates from './Estimates';

import type { PropType } from 'vue';
import type { BeneficiaryDetails } from '@/stores/api/beneficiaries';
import type { Estimate as EstimateType } from '@/stores/api/estimates';
import type { Invoice as InvoiceType } from '@/stores/api/invoices';

type Props = {
    /** Le bénéficiaire dont on veut afficher les devis et factures. */
    beneficiary: BeneficiaryDetails,
};

type Data = {
    isFetched: boolean,
    hasCriticalError: boolean,
    estimates: EstimateType[],
    invoices: InvoiceType[],
};

/** Contenu de l'onglet "devis & factures" de la page de détails d'un bénéficiaire. */
const BeneficiaryViewBilling = defineComponent({
    name: 'BeneficiaryViewBilling',
    props: {
        beneficiary: {
            type: Object as PropType<Props['beneficiary']>,
            required: true,
        },
    },
    data: (): Data => ({
        isFetched: false,
        hasCriticalError: false,
        estimates: [],
        invoices: [],
    }),
    mounted() {
        this.fetchData();
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        async fetchData() {
            const { id } = this.beneficiary;

            try {
                const [estimates, invoices] = await Promise.all([
                    apiBeneficiaries.estimates(id),
                    apiBeneficiaries.invoices(id),
                ]);

                this.estimates = estimates;
                this.invoices = invoices;
                this.isFetched = true;
            } catch {
                this.hasCriticalError = true;
            }
        },
    },
    render() {
        const { $t: __, isFetched, hasCriticalError, estimates, invoices } = this;

        if (hasCriticalError || !isFetched) {
            return (
                <div class="BeneficiaryViewBilling BeneficiaryViewBilling--loading-error">
                    {hasCriticalError ? <CriticalError type={ErrorType.UNKNOWN} /> : <Loading />}
                </div>
            );
        }

        if (estimates.length === 0 && invoices.length === 0) {
            return (
                <div class="BeneficiaryViewBilling BeneficiaryViewBilling--empty">
                    <EmptyMessage message={__('page.beneficiary-view.billing.nothing')} />
                </div>
            );
        }

        return (
            <div class="BeneficiaryViewBilling">
                <div class="BeneficiaryViewBilling__invoices">
                    <Invoices invoices={invoices} />
                </div>
                <div class="BeneficiaryViewBilling__estimates">
                    <Estimates estimates={estimates} />
                </div>
            </div>
        );
    },
});

export default BeneficiaryViewBilling;
