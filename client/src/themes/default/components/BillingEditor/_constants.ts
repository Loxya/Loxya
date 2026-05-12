import type { ComputedRef, InjectionKey } from 'vue';

/** Identifiant de contexte autonome. */
export const STANDALONE_ENTITY = 'standalone';

/** Clé d'injection indiquant si l'éditeur de facture est en mode compact. */
export const IsCompactKey: InjectionKey<ComputedRef<boolean>> = (
    Symbol('BillingEditor.is-compact')
);

/** Clé d'injection indiquant si l'éditeur de facture est en mode autonome. */
export const IsStandaloneKey: InjectionKey<ComputedRef<boolean>> = (
    Symbol('BillingEditor.is-standalone')
);
