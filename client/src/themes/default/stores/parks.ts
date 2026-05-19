import createEntityStore from '@/utils/createEntityStore';
import apiParks from '@/stores/api/parks';

import type { RootState } from '.';
import type { EntityState } from '@/utils/createEntityStore';
import type { ParkSummary } from '@/stores/api/parks';

export type State = EntityState<ParkSummary>;

export default createEntityStore<ParkSummary, RootState>(
    () => apiParks.list(),
    {
        getName: (state: State) => (
            (parkId: ParkSummary['id']): string | null => {
                const park = state.list.find((_park) => _park.id === parkId);
                return park?.name ?? null;
            }
        ),

        firstPark: (state: State): ParkSummary | undefined => (
            [...state.list].shift()
        ),
    },
);
