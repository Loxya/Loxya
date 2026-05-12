import createEntityStore from '@/utils/createEntityStore';
import apiDegressiveRates from '@/stores/api/degressive-rates';

import type { RootState } from '.';
import type { EntityState } from '@/utils/createEntityStore';
import type { DegressiveRate } from '@/stores/api/degressive-rates';

export type State = EntityState<DegressiveRate>;

export default createEntityStore<DegressiveRate, RootState>(
    () => apiDegressiveRates.all(),
    {
        getName: (state: State) => (
            (id: DegressiveRate['id']): string | null => {
                const degressiveRate = state.list.find(
                    (_degressiveRate) => _degressiveRate.id === id,
                );
                return degressiveRate?.name ?? null;
            }
        ),
    },
);
