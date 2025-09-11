import './index.scss';
import { defineComponent } from 'vue';
import groupByCategories, { SortBy } from './utils/groupByCategories';
import Category from './components/Category';

import type { PropType } from 'vue';
import type { EventDetails } from '@/stores/api/events';
import type { EmbeddedMaterialsByCategory } from './utils/groupByCategories';
import type { CategoryDetails } from '@/stores/api/categories';
import type { SourceMaterial } from '../../../../_types';

type Props = {
    /** L'événement sélectionné, dont on veut afficher la liste du matériel. */
    event: EventDetails,

    /**
     * La liste du matériel disponible au moment de l'import, avec
     * les informations de surcharge, si disponible.
     */
    allMaterials: SourceMaterial[],

    /** Doit-on afficher les informations liées à la facturation ? */
    withBilling: boolean,
};

const ImportFromEventSelectedSummary = defineComponent({
    name: 'ImportFromEventSelectedSummary',
    props: {
        event: {
            type: Object as PropType<Props['event']>,
            required: true,
        },
        allMaterials: {
            type: Array as PropType<Props['allMaterials']>,
            required: true,
        },
        withBilling: {
            type: Boolean as PropType<Required<Props>['withBilling']>,
            required: true,
        },
    },
    computed: {
        allCategories(): CategoryDetails[] {
            return this.$store.state.categories.list ?? [];
        },

        sortedMaterials(): EmbeddedMaterialsByCategory[] {
            const { event, allMaterials, allCategories, withBilling } = this;

            return groupByCategories(
                event.materials,
                allMaterials,
                allCategories,
                withBilling ? SortBy.PRICE : SortBy.NAME,
            );
        },
    },
    created() {
        this.$store.dispatch('categories/fetch');
    },
    render() {
        const { sortedMaterials, withBilling } = this;

        const renderMaterials = (): JSX.Element[] => (
            sortedMaterials.map(
                (category: EmbeddedMaterialsByCategory) => (
                    <Category
                        key={category.id ?? undefined}
                        data={category}
                        withBilling={withBilling}
                    />
                ),
            )
        );

        return (
            <div class="ImportFromEventSelectedSummary">
                {renderMaterials()}
            </div>
        );
    },
});

export default ImportFromEventSelectedSummary;
