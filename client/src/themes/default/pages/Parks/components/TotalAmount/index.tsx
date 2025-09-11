import './index.scss';
import { defineComponent } from 'vue';
import apiParks from '@/stores/api/parks';
import Button from '@/themes/default/components/Button';
import formatAmount from '@/utils/formatAmount';

import type Decimal from 'decimal.js';
import type { PropType, Raw } from 'vue';
import type { Park } from '@/stores/api/parks';

type Props = {
    /** Le parc dont on veut calculer le montant de remplacement total. */
    park: Park,
};

type Data = {
    amount: Raw<Decimal> | null,
    loading: boolean,
};

/** Bouton permettant de calculer le montant de remplacement total d'un parc. */
const ParksTotalAmount = defineComponent({
    name: 'ParksTotalAmount',
    props: {
        park: {
            type: Object as PropType<Props['park']>,
            required: true,
        },
    },
    data: (): Data => ({
        amount: null,
        loading: false,
    }),
    methods: {
        async handleCalculate() {
            const { id } = this.park;
            this.loading = true;
            try {
                this.amount = await apiParks.oneTotalAmount(id);
            } catch {
                const { $t: __ } = this;
                this.$toasted.error(__('errors.unexpected-while-calculating'));
            } finally {
                this.loading = false;
            }
        },
    },
    render() {
        const { $t: __, park, handleCalculate, loading, amount } = this;

        if (!park.total_items) {
            return null;
        }

        return (
            <div class="ParksTotalAmount">
                {amount === null && (
                    <Button onClick={handleCalculate} loading={loading}>
                        {__('calculate')}
                    </Button>
                )}
                {amount !== null && (
                    <div class="ParksTotalAmount__amount">
                        {formatAmount(amount)}
                    </div>
                )}
            </div>
        );
    },
});

export default ParksTotalAmount;
