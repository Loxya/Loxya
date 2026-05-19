import type { ComputedRef, InjectionKey } from 'vue';

/**
 * Clé d'injection indiquant si le formulaire parent est
 * affiché en disposition verticale.
 */
export const VerticalFormKey: InjectionKey<boolean> = (
    Symbol('@global.vertical-form')
);

/**
 * Clé d'injection propageant l'état "désactivé" hérité d'un composant parent.
 *
 * La valeur peut être une chaîne de caractères, auquel cas celle-ci
 * représente la raison de la désactivation.
 */
export const DisabledKey: InjectionKey<ComputedRef<boolean | string>> = (
    Symbol('@global.disabled')
);

/** Clé d'injection propageant l'état "invalide" hérité d'un composant parent. */
export const InvalidKey: InjectionKey<ComputedRef<boolean>> = (
    Symbol('@global.invalid')
);
