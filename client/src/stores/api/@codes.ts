/* eslint-disable import/prefer-default-export */

/**
 * Codes d'erreur retournés par l'API.
 *
 * NOTE IMPORTANTE:
 * En cas de modif., pensez à aussi mettre à jour le fichier lié dans la partie back-end.
 * {@see {@link /server/src/App/Errors/Enums/ApiErrorCode.php}}
 */
export enum ApiErrorCode {
    /** Erreur inconnue ou sans prise en charge. */
    UNKNOWN = 0,

    //
    // - Erreurs liées à la réinitialisation de mot de passe.
    //

    /**
     * Si le code de réinitialisation de mot passe utilisé est
     * obsolète (parce qu'il a été supprimé, parce que l'adresse email
     * du compte n'est plus la même, parce qu'il n'y a jamais eu de code)
     */
    PASSWORD_RESET_OBSOLETE_CODE = 130,

    /**
     * Si le code de réinitialisation fourni est invalide ou ne correspond
     * pas à celui actuellement en cours pour cette réinitialisation.
     *
     * Attention, le nombre de tentatives est limitée, au delà une
     * temporisation sera appliqué.
     */
    PASSWORD_RESET_WRONG_CODE = 131,

    /**
     * S'il y a eu trop de tentatives de confirmation de la
     * réinitialisation avec code invalide.
     */
    PASSWORD_RESET_TOO_MANY_ATTEMPTS = 132,

    //
    // - Erreurs liées aux formulaires.
    //

    /** Une ou plusieurs erreurs de validation se sont produites. */
    VALIDATION_FAILED = 400,

    /** Le payload fourni dans la requête ne doit pas être vide. */
    EMPTY_PAYLOAD = 401,
}
