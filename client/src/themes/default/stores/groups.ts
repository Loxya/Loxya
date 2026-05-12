import createEntityStore from '@/utils/createEntityStore';
import apiGroups from '@/stores/api/groups';

import type { RootState } from '.';
import type { EntityState } from '@/utils/createEntityStore';
import type { Group, GroupDetails } from '@/stores/api/groups';

export type State = EntityState<GroupDetails>;

export default createEntityStore<GroupDetails, RootState>(
    () => apiGroups.all(),
    {
        get: (state: State) => (
            (id: Group): GroupDetails | null => (
                state.list.find(({ id: _id }: GroupDetails) => _id === id) ?? null
            )
        ),

        getName: (state: State) => (
            (id: Group): string | null => {
                const group = state.list.find((_group) => _group.id === id);
                return group?.name ?? null;
            }
        ),
    },
);
