import { z } from '@/utils/validation';

import type { Tag } from '@/stores/api/tags';
import type { Material } from '@/stores/api/materials';
import type { Category } from '@/stores/api/categories';
import type { ParkSummary as Park } from '@/stores/api/parks';
import type { SubCategory } from '@/stores/api/subcategories';

/** Les différents verrous possibles pour les inventaires. */
export enum InventoryLock {
    /** L'état du matériel ne pourra pas être inventorié. */
    STATE = 'state',

    /** Les commentaires seront en lecture seule. */
    COMMENT = 'comment',
}

/**
 * Un des matériels attendus dans l'inventaire.
 *
 * Ceci doit être un objet avec les informations de base du matériel et les clés suivantes:
 * - `awaitedQuantity`: La quantité attendu pour ce matériel (et non la quantité en stock).
 * - `awaitedUnits`: Doit contenir les unités attendues (et uniquement celles-ci) sous
 *                   la forme d'un tableau d'unités {@link AwaitedMaterialUnit}.
 *                   (si le matériel n'est PAS unitaire, ce doit être un tableau vide)
 * - `comment`: Un commentaire d'un précédent inventaire éventuel au sujet du matériel.
 *              (uniquement si l'inventaire permet d'afficher les commentaires)
 */
export type AwaitedMaterial<
    WithComments extends boolean = boolean,
> = (
    & {
        /* eslint-disable @typescript-eslint/naming-convention */
        id: Material['id'],
        name: string,
        reference: string,
        category_id: Category['id'] | null,
        sub_category_id: SubCategory['id'] | null,
        tags: Tag[],
        park_id: Park['id'] | null,
        awaitedQuantity: number,
        /* eslint-enable @typescript-eslint/naming-convention */
    }
    & (
        // eslint-disable-next-line @typescript-eslint/no-empty-object-type
        WithComments extends true ? { comment?: string | null } : {}
    )
);

export type AwaitedMaterialGroup<Group extends Category | Park = Category | Park> = (
    & (
        | { id: Group['id'], name: Group['name'] }
        | { id: null, name: null }
    )
    & { materials: AwaitedMaterial[] }
);

/**
 * L'inventaire d'un matériel.
 *
 * Doit contenir un objet avec les clés suivantes:
 * - `id`: L'identifiant du matériel (existant dans le {@link AwaitedMaterial} lié donc) dont c'est l'inventaire.
 * - `actual`: La quantité effectivement "trouvée" pour le matériel.
 * - `broken`: La quantité inventoriée cassée pour le matériel.
 *             (Si l'inventaire permet d'inventorier les quantités cassés)
 * - `comment`: Un commentaire éventuel au sujet du matériel.
 *              (Si l'inventaire permet d'éditer des commentaires d'inventaire)
 */
export type InventoryMaterial<
    WithBrokenCount extends boolean = boolean,
    WithComments extends boolean = boolean,
> = (
    {
        id: AwaitedMaterial['id'],
        actual: number,
    }
    & (
        // eslint-disable-next-line @typescript-eslint/no-empty-object-type
        WithBrokenCount extends true ? { broken: number } : {}
    )
    & (
        // eslint-disable-next-line @typescript-eslint/no-empty-object-type
        WithComments extends true ? { comment?: string | null } : {}
    )
);

/**
 * Les données d'inventaire d'un matériel.
 *
 * @see {@link InventoryMaterial} pour plus d'informations.
 */
export type InventoryMaterialData<
    WithBrokenCount extends boolean = boolean,
    WithComments extends boolean = boolean,
> = Omit<InventoryMaterial<WithBrokenCount, WithComments>, 'id'>;

/**
 * Les données d'un inventaire.
 *
 * Doit contenir un tableau de {@link InventoryMaterial}.
 */
export type InventoryData<
    WithBrokenCount extends boolean = boolean,
    WithComments extends boolean = boolean,
> = Array<InventoryMaterial<WithBrokenCount, WithComments>>;

//
// - Errors
//

export const InventoryErrorsSchema = z.array(z.object({
    id: z.number(),
    message: z.string().optional(),
}));

export type InventoryMaterialError = {
    id: AwaitedMaterial['id'],
    message?: string | undefined,
};
