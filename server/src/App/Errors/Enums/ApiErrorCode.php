<?php
declare(strict_types=1);

namespace Loxya\Errors\Enums;

/**
 * Codes d'erreur retournés par l'API.
 *
 * NOTE IMPORTANTE:
 * En cas de modif., pensez à aussi mettre à jour le fichier lié dans la partie front-end.
 * {@see {@link /client/src/stores/api/@codes.ts}}
 */
enum ApiErrorCode: int
{
    /** Erreur inconnue ou sans prise en charge. */
    case UNKNOWN = 0;

    //
    // - Erreurs liées aux réservations.
    //

    /**
     * Les réservations ne sont pas ouvertes dans cette application.
     * (ou en tous cas pas pour cet utilisateur / bénéficiaire)
     */
    case RESERVATION_DISABLED = 100;

    /**
     * Si un panier de réservation a expiré.
     *
     * Note: Ce code n'est accessible que pendant 1 heure à partir du
     * moment ou le panier a expiré. Au delà, ce sera comme si le panier
     * n'avait jamais existé (Voir `RESERVATION_CART_MISSING`).
     */
    case RESERVATION_CART_EXPIRED = 101;

    /** S'il n'y a aucun panier de réservation en cours. */
    case RESERVATION_CART_MISSING = 102;

    //
    // - Erreurs liées à la réinitialisation de mot de passe.
    //

    /**
     * Si le code de réinitialisation de mot passe utilisé est
     * obsolète (parce qu'il a été supprimé, parce que l'adresse email
     * du compte n'est plus la même, parce qu'il n'y a jamais eu de code)
     */
    case PASSWORD_RESET_OBSOLETE_CODE = 130;

    /**
     * Si le code de réinitialisation fourni est invalide ou ne correspond
     * pas à celui actuellement en cours pour cette réinitialisation.
     *
     * Attention, le nombre de tentatives est limitée, au delà une
     * temporisation sera appliqué.
     */
    case PASSWORD_RESET_WRONG_CODE = 131;

    /**
     * S'il y a eu trop de tentatives de confirmation de la
     * réinitialisation avec code invalide.
     */
    case PASSWORD_RESET_TOO_MANY_ATTEMPTS = 132;

    //
    // - Erreurs liées aux formulaires.
    //

    /** Une ou plusieurs erreurs de validation se sont produites. */
    case VALIDATION_FAILED = 400;

    /** Le payload fourni dans la requête ne doit pas être vide. */
    case EMPTY_PAYLOAD = 401;
}
