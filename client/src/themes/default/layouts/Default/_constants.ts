import type { InjectionKey } from 'vue';

/** Clé d'injection pour la fonction de contrôle de l'ouverture de la barre latérale. */
export const SetGlobalSidebarStateKey: InjectionKey<(isOpen: boolean | 'toggle') => void> = (
    Symbol('DefaultLayout.set-global-sidebar-state')
);

/** Clé d'injection pour la fonction de contrôle de l'indicateur de chargement global. */
export const SetGlobalLoadingKey: InjectionKey<(isLoading: boolean) => void> = (
    Symbol('DefaultLayout.set-global-loading')
);
