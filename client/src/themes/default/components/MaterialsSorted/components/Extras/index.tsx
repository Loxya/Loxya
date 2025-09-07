import './index.scss';
import { defineComponent } from 'vue';
import Item from './Item';

import type Currency from '@/utils/currency';
import type { PropType } from 'vue';
import type { EmbeddedExtra } from '../../_types';

type Props = {
    /** Les extras à afficher. */
    data: EmbeddedExtra[],

    /** Doit-on afficher les informations liées à la facturation ? */
    withBilling: boolean,

    /**
     * La devise à utiliser pour les prix.
     *
     * - Uniquement si `withBilling` est utilisé.
     * - Si non fournie, la devise par défaut sera utilisée.
     */
    currency?: Currency,
};

/** Les extras liés à une liste de matériel. */
const MaterialsSortedExtras = defineComponent({
    name: 'MaterialsSortedExtras',
    props: {
        data: {
            type: Array as PropType<Required<Props>['data']>,
            required: true,
        },
        withBilling: {
            type: Boolean as PropType<Required<Props>['withBilling']>,
            default: false,
        },
        currency: {
            type: Object as PropType<Props['currency']>,
            default: undefined,
        },
    },
    render() {
        const {
            $t: __,
            data,
            withBilling,
            currency,
        } = this;

        return (
            <div class="MaterialsSortedExtras">
                <h4 class="MaterialsSortedExtras__title">
                    {__('other')}
                </h4>
                <table class="MaterialsSortedExtras__list">
                    {data.map((extra: EmbeddedExtra) => (
                        <Item
                            key={extra.id}
                            extra={extra}
                            withBilling={withBilling}
                            currency={currency}
                        />
                    ))}
                </table>
            </div>
        );
    },
});

export default MaterialsSortedExtras;
