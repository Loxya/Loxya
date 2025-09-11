import './index.scss';
import { defineComponent } from 'vue';
import groupByCategories, { SortBy } from './utils/groupByCategories';
import Category from './components/Category';
import Extras from './components/Extras';

import type Currency from '@/utils/currency';
import type { PropType } from 'vue';
import type { EmbeddedMaterialsByCategory } from './utils/groupByCategories';
import type { EmbeddedExtra, EmbeddedMaterial } from './_types';

type Props = {
    /**
     * La liste du matériel embarquée à classer.
     *
     * On entends par "embarquée" un matériel qui est en quantité définie, potentiellement
     * avec certaines de ses unités, dans une liste, une réservation, un événement.
     */
    materials: EmbeddedMaterial[],

    /** La liste des extras embarqués à afficher en plus du matériel. */
    extras: EmbeddedExtra[],

    /** Doit-on afficher les informations liées à la facturation ? */
    withBilling?: boolean,

    /**
     * La devise à utiliser pour les prix.
     *
     * - Uniquement si `withBilling` est utilisé.
     * - Si non fournie, la devise par défaut sera utilisée.
     */
    currency?: Currency,
};

/**
 * Liste de matériel triée.
 *
 * Affiche une liste de matériel embarquée (événement, réservation), classé
 * par catégories (classement par défaut), ou par sous-liste de matériel.
 *
 * Le classement par sous-liste est réservé aux événements. Dans chaque sous-liste,
 * le matériel est aussi classé par catégories.
 */
const MaterialsSorted = defineComponent({
    name: 'MaterialsSorted',
    props: {
        materials: {
            type: Array as PropType<Props['materials']>,
            required: true,
        },
        extras: {
            type: Array as PropType<Required<Props>['extras']>,
            default: () => [],
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
    computed: {
        sortedMaterials(): EmbeddedMaterialsByCategory[] {
            const { materials } = this;

            const allCategories = this.$store.state.categories.list;
            return groupByCategories(
                materials,
                allCategories ?? [],
                SortBy.NAME,
            );
        },
    },
    created() {
        this.$store.dispatch('categories/fetch');
    },
    render() {
        const { sortedMaterials, extras, withBilling, currency } = this;

        const renderMaterials = (): JSX.Element[] => (
            sortedMaterials.map(
                (category: EmbeddedMaterialsByCategory) => (
                    <Category
                        key={category.id ?? undefined}
                        data={category}
                        withBilling={withBilling}
                        currency={currency}
                    />
                ),
            )
        );

        return (
            <div class="MaterialsSorted">
                {renderMaterials()}
                {extras.length > 0 && (
                    <div class="MaterialsSorted__extras">
                        <Extras
                            data={extras}
                            withBilling={withBilling}
                            currency={currency}
                        />
                    </div>
                )}
            </div>
        );
    },
});

export default MaterialsSorted;
