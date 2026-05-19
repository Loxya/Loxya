import type { RawComponent } from 'vue';

/**
 * Options statiques d'une modale.
 *
 * Ces options sont déclarées via la propriété `modal`
 * du composant rendu dans la modale.
 */
export type ModalOptions = {
    /**
     * Largeur de la modale (pixels ou pourcentage).
     *
     * @default 950
     */
    width?: number | `${number}%`,

    /**
     * Hauteur de la modale (pixels, pourcentage ou 'auto').
     *
     * @default 'auto'
     */
    height?: number | `${number}%` | 'auto',

    /**
     * Autorise l'utilisateur à fermer la modale via un clic sur
     * l'overlay ou la touche "Échap".
     *
     * @default true
     */
    dismissible?: boolean,
};

/** Événement `onClose`. */
export type ModalCloseEvent<Data = any> = {
    /** Données passées à la fermeture de la modale. */
    data: Data | undefined,

    /** Une fonction permettant d'annuler la fermeture de la modale. */
    cancel(): void,
};

/** Handlers optionnels de cycle de vie de la modale. */
export type ModalLifecycleProps<Data = any> = {
    /** Handler appelé juste avant que la transition d'entrée commence. */
    onOpen?(): void,

    /** Handler appelé une fois la transition d'entrée terminée. */
    onOpened?(): void,

    /**
     * Handler appelé à la demande de fermeture, avec possibilité d'annulation.
     *
     * @param event - Un payload contenant les données de fermeture ainsi
     *                qu'une fonction permettant d'annuler la fermeture.
     */
    onClose?(event: ModalCloseEvent<Data>): void,

    /** Handler appelé une fois la transition de sortie terminée. */
    onClosed?(): void,
};

/** Props d'un component à monter dans une modale. */
export type ModalComponentProps<Data = any> = {
    onClose?(data?: Data | undefined): void,
};

/** Composant utilisable comme contenu de modale. */
export type ModalComponent<
    Data = any,
    Props extends ModalComponentProps<Data> = ModalComponentProps<Data>,
> = RawComponent<Props> & { modal?: ModalOptions };

/**
 * Props passées à `$modal.show()` pour l'affichage d'une fenêtre modale.
 *
 * Les props sont celles du component à monter dans la modale ainsi que
 * d'éventuelles props. de cycle de vie de la modale.
 */
export type ModalProps<Data, Props extends ModalComponentProps<Data>> = (
    & Omit<Props, 'onClose'>
    & ModalLifecycleProps<Data>
);
