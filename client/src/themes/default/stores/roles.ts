import createEntityStore from '@/utils/createEntityStore';
import apiRoles from '@/stores/api/roles';

import type { RootState } from '.';
import type { EntityState } from '@/utils/createEntityStore';
import type { Role } from '@/stores/api/roles';

export type State = EntityState<Role>;

export default createEntityStore<Role, RootState>(
    () => apiRoles.all(),
);
