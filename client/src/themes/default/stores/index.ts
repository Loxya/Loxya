import globalStores from '@/stores';
import parksStore from './parks';
import categoriesStore from './categories';
import tagsStore from './tags';
import degressiveRatesStore from './degressive-rates';
import groupsStore from './groups';
import taxesStore from './taxes';
import rolesStore from './roles';

import type { State as ParsState } from './parks';
import type { RootState as RootStateBase } from '@/stores';
import type { State as CategoriesState } from './categories';
import type { State as DegressiveRatesState } from './degressive-rates';
import type { State as GroupsState } from './groups';
import type { State as RolesState } from './roles';
import type { State as TagsState } from './tags';
import type { State as TaxesState } from './taxes';

export type RootState = RootStateBase & {
    parks: ParsState,
    categories: CategoriesState,
    tags: TagsState,
    degressiveRates: DegressiveRatesState,
    taxes: TaxesState,
    groups: GroupsState,
    roles: RolesState,
};

export default {
    ...globalStores,
    parks: parksStore,
    categories: categoriesStore,
    tags: tagsStore,
    degressiveRates: degressiveRatesStore,
    taxes: taxesStore,
    groups: groupsStore,
    roles: rolesStore,
};
