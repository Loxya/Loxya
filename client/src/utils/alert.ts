import Vue from 'vue';
import Sweetalert from 'sweetalert2/dist/sweetalert2';

import type {
    SweetAlertIcon,
    SweetAlertInput,
    SweetAlertResult,
    SweetAlertOptions,
} from 'sweetalert2';

/** Options pour la boîte de confirmation.  */
export type ConfirmOptions = {
    /**
     * Type de confirmation.
     *
     * @default 'info'
     */
    type?: 'warning' | 'danger' | 'success',

    /**
     * Titre de la boîte de confirmation.
     *
     * @default "Veuillez confirmer..." (localisé)
     */
    title?: string,

    /**
     * Texte du message affiché dans la
     * boîte de confirmation.
     */
    text?: string,

    /**
     * Texte du bouton de confirmation.
     *
     * @default "Confirmer" (localisé)
     */
    confirmButtonText?: string,
};

/** Options pour la boîte de saisie (prompt). */
export type PromptOptions = {
    /**
     * Type de champ de saisie utilisé.
     *
     * @default 'text'
     */
    inputType?: SweetAlertInput,

    /**
     * Texte affiché dans le champ de saisie comme placeholder.
     *
     * @default - Aucun.
     */
    placeholder?: string,

    /** Valeur initiale du champ de saisie. */
    inputValue?: string,

    /**
     * Texte du bouton de soumission.
     *
     * @default "Sauvegarde" (localisé)
     */
    confirmButtonText?: string,
};

/**
 * Wrap l'appel à SweetAlert en ne résolvant la promesse de retour que
 * quand SweetAlert a vraiment terminé son processing et a disparu de l'interface.
 *
 * Sans ça, le résultat est renvoyé avant le `didDestroy` de SweetAlert et lors
 * de celui-ci, SweetAlert change l'élément de la page qui a le focus (via un genre de `blur`)
 * et provoque des soucis pour le reste de l'application (qui voit son focus "sauter" ailleurs après coup).
 *
 * @param options - Les options passés à SweetAlert.
 *
 * @returns Une promesse contenant le résultat retourné par SweetAlert.
 */
const wrapSweetAlert = (options: SweetAlertOptions): Promise<SweetAlertResult> => (
    new Promise<SweetAlertResult>((resolve) => {
        const destroyDeferred = Promise.withResolvers<void>();
        const resultPromise = Sweetalert.fire({
            ...options,
            didDestroy() {
                destroyDeferred.resolve();
            },
        });

        Promise.all([resultPromise, destroyDeferred.promise]).then(
            ([result]) => { resolve(result); },
        );
    })
);

/**
 * Permet de créer un nouveau type d'alerte.
 *
 * @param icon - L'icône à utiliser.
 * @param title - Le titre de l'alerte.
 * @param message - Le corps de l'alerte.
 * @param autoClose - Permet de fermer automatiquement l'alerte.
 *                    Deux valeurs sont possibles:
 *                    - Un booléen, auquel cas ceci activera / désactivera la
 *                      fonctionnalité (avec un timer de 20s par défaut)
 *                    - Un nombre, en millisecondes, permettant de customiser le
 *                      délai avant fermeture automatique.
 */
const wrapAlert = (
    icon: SweetAlertIcon,
    title: string,
    message: string,
    autoClose: boolean | number,
): void => {
    const { translate: __ } = Vue.i18n;

    const autoCloseTimer: number | undefined = typeof autoClose === 'boolean'
        ? (autoClose === true ? 20_000 : undefined)
        : autoClose;

    wrapSweetAlert({
        icon,
        titleText: title,
        text: message,
        timer: autoCloseTimer,
        timerProgressBar: true,
        confirmButtonText: __('close'),
    });
};

/**
 * Affiche une alerte de type "error".
 *
 * @param title - Le titre de l'alerte.
 * @param message - Le corps de l'alerte.
 * @param autoClose - Permet de fermer automatiquement l'alerte.
 *                    Deux valeurs sont possibles:
 *                    - Un booléen, auquel cas ceci activera / désactivera la
 *                      fonctionnalité (avec un timer de 5s par défaut)
 *                    - Un nombre, en millisecondes, permettant de customiser le
 *                      délai avant fermeture automatique.
 */
export const error = (title: string, message: string, autoClose: boolean | number = false): void => {
    wrapAlert('error', title, message, autoClose);
};

/**
 * Affiche une alerte de type "warning".
 *
 * @param title - Le titre de l'alerte.
 * @param message - Le corps de l'alerte.
 * @param autoClose - Permet de fermer automatiquement l'alerte.
 *                    Deux valeurs sont possibles:
 *                    - Un booléen, auquel cas ceci activera / désactivera la
 *                      fonctionnalité (avec un timer de 5s par défaut)
 *                    - Un nombre, en millisecondes, permettant de customiser le
 *                      délai avant fermeture automatique.
 */
export const warning = (title: string, message: string, autoClose: boolean | number = false): void => {
    wrapAlert('warning', title, message, autoClose);
};

/**
 * Affiche une alerte de type "info".
 *
 * @param title - Le titre de l'alerte.
 * @param message - Le corps de l'alerte.
 * @param autoClose - Permet de fermer automatiquement l'alerte.
 *                    Deux valeurs sont possibles:
 *                    - Un booléen, auquel cas ceci activera / désactivera la
 *                      fonctionnalité (avec un timer de 5s par défaut)
 *                    - Un nombre, en millisecondes, permettant de customiser le
 *                      délai avant fermeture automatique.
 */
export const info = (title: string, message: string, autoClose: boolean | number = false): void => {
    wrapAlert('info', title, message, autoClose);
};

/**
 * Affiche une boîte de confirmation.
 *
 * @param options - Deux formats possibles :
 *                  - Une chaîne de caractère: Sera utilisée comme texte du message
 *                    affiché dans la boîte de confirmation. Les autres valeurs seront
 *                    celles par défaut.
 *                  - Un objet littéral permettant de customiser les options de manière
 *                    avancée, voir {@link ConfirmOptions}.
 *
 * @returns Une promesse résolue avec `true` si l'utilisateur à confirmé, `false` sinon.
 */
export const confirm = async (options: string | ConfirmOptions): Promise<boolean> => {
    const { translate: __ } = Vue.i18n;

    if (typeof options === 'string') {
        options = { text: options };
    }

    const {
        type = 'info',
        title = __('please-confirm'),
        confirmButtonText = __('confirm'),
        text,
    } = options;

    const { isConfirmed } = await wrapSweetAlert({
        icon: 'warning',
        title,
        text,
        showCancelButton: true,
        customClass: {
            confirmButton: `swal2-confirm--${type}`,
        },
        confirmButtonText,
        cancelButtonText: __('cancel'),
    });

    return isConfirmed;
};

/**
 * Affiche une boîte de saisie (prompt).
 *
 * @param title - Le titre de la boîte de saisie.
 * @param options - Un objet littéral permettant de customiser les options
 *                  de manière avancée, voir {@link PromptOptions}.
 *
 * @returns Une promesse résolue avec la valeur saisie par l'utilisateur ou `undefined`.
 *
 * @deprecated Il faut plutôt utiliser une modale, notamment pour la gestion des erreurs.
 */
export const prompt = async <T = any>(title: string, options: PromptOptions = {}): Promise<T> => {
    const { translate: __ } = Vue.i18n;

    const {
        placeholder = '',
        confirmButtonText = __('save'),
        inputType = 'text',
        inputValue = '',
    } = options;

    const { value } = await wrapSweetAlert({
        title,
        input: inputType,
        inputPlaceholder: placeholder,
        inputValue,
        showCancelButton: true,
        confirmButtonText,
        cancelButtonText: __('cancel'),
        customClass: {
            confirmButton: 'swal2-confirm--success',
        },
    });

    return value;
};
