<?php
declare(strict_types=1);

namespace Loxya\Mails;

use Loxya\Contracts\Mailable;

/**
 * Email de réinitialisation de mot de passe (code envoyé par mail).
 */
final class PasswordReset extends Mailable
{
    protected const VIEW = 'password-reset';

    public function __construct(
        public readonly string $code,
        public readonly int $codeDuration,
    ) {}

    public function getRawSubject(): string
    {
        return 'password-reset';
    }
}
