import './index.scss';
import { defineComponent } from 'vue';
import Link from '@/themes/default/components/Link';

import type { PropType } from 'vue';
import type { Park } from '@/stores/api/parks';

type Props = {
    /** Le matériel pour lequel on veut afficher les quantités. */
    park: Park,
};

/** Affiche le nombre d'articles d'un parc avec un lien vers la liste du matériel. */
const ParksItemsCount = defineComponent({
    name: 'ParksItemsCount',
    props: {
        park: {
            type: Object as PropType<Required<Props>['park']>,
            required: true,
        },
    },
    render() {
        const { $t: __, park } = this;
        const { id, total_items: itemsCount, total_stock_quantity: totalStockCount } = park;

        if (itemsCount === 0) {
            return (
                <div class="ParksItemsCount ParksItemsCount--empty">
                    {__('no-items')}
                </div>
            );
        }

        return (
            <div class="ParksItemsCount">
                <Link
                    to={{
                        name: 'materials',
                        query: { park: id.toString() },
                    }}
                    tooltip={__('page.parks.display-materials-of-this-park')}
                    class="ParksItemsCount__link"
                >
                    {__('materials-count', { count: itemsCount }, itemsCount)}
                </Link>
                <div class="ParksItemsCount__total-stock">
                    ({__('stock-items-count', { count: totalStockCount })})
                </div>
            </div>
        );
    },
});

export default ParksItemsCount;
