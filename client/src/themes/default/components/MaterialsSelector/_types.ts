import type Decimal from 'decimal.js';
import type Currency from '@/utils/currency';
import type { Tag } from '@/stores/api/tags';
import type { Park } from '@/stores/api/parks';
import type { Category } from '@/stores/api/categories';
import type { SubCategory } from '@/stores/api/subcategories';
import type { Booking as BookingCore } from '@/stores/api/bookings';
import type {
    EventDetails,
    EventMaterial,
} from '@/stores/api/events';
import type {
    Material,
    MaterialWithContext,
    MaterialWithAvailability,
} from '@/stores/api/materials';

export type Filters = {
    /** Recherche sur un nom de matériel ou une référence. */
    search: string[],

    /**
     * Filtre sur le parc dans lequel sont situés les matériels.
     * (ou les unités de matériel lorsque le matériel est unitaire)
     */
    park: Park['id'] | null,

    /** Filtre sur la catégorie des matériels. */
    category: Category['id'] | 'uncategorized' | null,

    /** Filtre sur la sous-catégorie des matériels. */
    subCategory: SubCategory['id'] | null,

    /**
     * Filtre sur l'état de sélection des matériels.
     * (= n'affichera que le matériel qui a été sélectionné (avec une quantité > 0 donc)).
     */
    onlySelected: boolean,

    /** Filtre sur les tags des matériels (recherche de type `OR`). */
    tags: Array<Tag['id']>,
};

//
// - Bookable
//

export enum BookableEntity {
    EVENT = 'event',
}

export type Bookable = (
    | BookingCore
    | { entity: BookableEntity.EVENT } & EventDetails
);

//
// - Embedded materiel
//

export type EmbeddedMaterial = (
    | EventMaterial
);

//
// - Source material
//

/* eslint-disable @typescript-eslint/naming-convention */
export type SourceMaterialOverrides = {
    name: string,
    reference: string,
    rental_price?: Decimal,
    degressive_rate?: Decimal,
    rental_price_period?: Decimal,
    replacement_price: Decimal | null,
    currency: Currency,
};
/* eslint-enable @typescript-eslint/naming-convention */

export type SourceMaterial = (
    & (MaterialWithAvailability | MaterialWithContext)
    & { overrides: SourceMaterialOverrides | null }
);

//
// - Selected material
//

export type SelectedMaterial = {
    id: Material['id'],
    quantity: number,
};
