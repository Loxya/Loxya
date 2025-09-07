import './index.scss';
import { defineComponent } from 'vue';
import apiEvents from '@/stores/api/events';
import { BookingEntity } from '@/stores/api/bookings';

import type { PropType } from 'vue';
import type { Booking as BookingCore } from '@/stores/api/bookings';
import type { Event, EventMaterialWithQuantityMissing } from '@/stores/api/events';

export enum BookableEntity {
    EVENT = 'event',
}

type Bookable = (
    | BookingCore
    | { entity: BookableEntity.EVENT } & Event
);

type BookableMaterialWithQuantityMissing = (
    | EventMaterialWithQuantityMissing
);

type Props = {
    /**
     * Le bookable ({@see {@link Bookable}}) dont on
     * veut afficher le matériel manquant.
     */
    bookable: Bookable,
};

type Data = {
    hasCriticalError: boolean,
    missingMaterials: BookableMaterialWithQuantityMissing[],
};

/** Liste du matériel manquant d'un bookable. */
const MissingMaterials = defineComponent({
    name: 'MissingMaterials',
    props: {
        bookable: {
            type: Object as PropType<Props['bookable']>,
            required: true,
        },
    },
    data: (): Data => ({
        hasCriticalError: false,
        missingMaterials: [],
    }),
    computed: {
        hasMissingMaterials(): boolean {
            return this.missingMaterials.length > 0;
        },
    },
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
            const { bookable } = this;
            try {
                this.missingMaterials = await apiEvents.missingMaterials(bookable.id);
            } catch {
                this.hasCriticalError = true;
            }
        },

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            key = !key.startsWith('global.')
                ? `components.MissingMaterials.${key}`
                : key.replace(/^global\./, '');

            return this.$t(key, params, count);
        },
    },
    render() {
        const {
            __,
            bookable,
            missingMaterials,
            hasCriticalError,
            hasMissingMaterials,
        } = this;

        if (hasCriticalError) {
            return (
                <div class="MissingMaterials">
                    <div class="MissingMaterials__header">
                        <h3 class="MissingMaterials__header__title">
                            {__('title')}
                        </h3>
                    </div>
                    <p class="MissingMaterials__error">
                        {__('global.errors.unexpected-while-fetching')}
                    </p>
                </div>
            );
        }

        if (!hasMissingMaterials) {
            return null;
        }

        const renderHelp = (): JSX.Node => {
            if ([BookingEntity.EVENT, BookableEntity.EVENT].includes(bookable.entity)) {
                return __('help.event');
            }
            return __('help.general');
        };

        return (
            <div class="MissingMaterials">
                <div class="MissingMaterials__header">
                    <h3 class="MissingMaterials__header__title">
                        {__('title')}
                    </h3>
                    <p class="MissingMaterials__header__help">
                        {renderHelp()}
                    </p>
                </div>
                <ul class="MissingMaterials__list">
                    {missingMaterials.map((missingMaterial: BookableMaterialWithQuantityMissing) => (
                        <li key={missingMaterial.id} class="MissingMaterials__list__item">
                            <div class="MissingMaterials__list__item__name">
                                {missingMaterial.name}
                            </div>
                            <div class="MissingMaterials__list__item__quantity">
                                {__('missing-count', {
                                    quantity: missingMaterial.quantity,
                                    missing: missingMaterial.quantity_missing,
                                })}
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        );
    },
});

export default MissingMaterials;
