import type { MaterialWithAvailability as Material } from '@/stores/api/materials';
import type { State } from '../_types';

/**
 * Retourne une fonction permettant de récupérer la quantité sélectionnée
 * pour un matériel en particulier dans le store.
 *
 * @param state - Le store actuel, contenant les quantités.
 *
 * @returns Une fonction permettant de récupérer la quantité d'un matériel en particulier dans le store.
 */
const getQuantity = (state: State) => (
    /**
     * Permet de récupérer la quantité sélectionnée pour un matériel en particulier dans le store.
     *
     * @param id - L'identifiant du matériel pour lequel on veut récupérer la quantité.
     *
     * @returns La quantité sélectionnée pour le matériel (et la liste) spécifiée.
     */
    (id: Material['id']): number => {
        const materialState = state.materials[id];
        if (!materialState) {
            return 0;
        }

        return Math.max(materialState.quantity, 0);
    }
);

export default getQuantity;
