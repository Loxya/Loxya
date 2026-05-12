import authStore from './auth';
import settingsStore from './settings';

import type { State as AuthStoreState } from './auth';
import type { State as SettingsStoreState } from './settings';

export type RootState = {
    auth: AuthStoreState,
    settings: SettingsStoreState,
};

export default {
    auth: authStore,
    settings: settingsStore,
};
