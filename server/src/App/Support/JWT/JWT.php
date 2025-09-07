<?php
declare(strict_types=1);

namespace Loxya\Support\JWT;

use Firebase\JWT\JWT as JWTCore;

final class JWT extends JWTCore
{
    /**
     * Définit une date fixe à utiliser pour les tests dans la génération de tokens.
     *
     * @param \DateTimeInterface|null $testNow La date de test à fixer, ou `null` pour la réinitialiser.
     */
    public static function setTestNow(\DateTimeInterface|null $testNow = null)
    {
        static::$timestamp = $testNow?->getTimestamp();
    }

    /**
     * Indique si une date de test a été définie pour la génération de tokens.
     *
     * @return bool `true` si une date de test a été définie, `false` sinon.
     */
    public static function hasTestNow(): bool
    {
        return static::$timestamp !== null;
    }
}
