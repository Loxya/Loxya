<?php
declare(strict_types=1);

namespace Loxya\Support\JWT;

/** Types de scopes pouvant être associés à un token JWT. */
enum TokenScope: string
{
    /** Scope utilisé pour l'authentification d'un utilisateur. */
    case AUTH = 'auth';

    /**
     * Scope utilisé dans le cadre d'une procédure
     * de réinitialisation de mot de passe.
     */
    case PASSWORD_RESET = 'password-reset';
}
