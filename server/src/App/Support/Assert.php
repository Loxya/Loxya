<?php
declare(strict_types=1);

namespace Loxya\Support;

use Illuminate\Support\Collection;
use Webmozart\Assert\Assert as AssertCore;
use Webmozart\Assert\InvalidArgumentException;

class Assert extends AssertCore
{
    /**
     * Permet de s'assurer qu'une énumération existe.
     *
     * @param mixed  $value Le nom complet de l'énumération.
     * @param string $message Un éventuel message d'erreur en remplacement de celui par défaut.
     *
     * @throws InvalidArgumentException
     */
    public static function enumExists($value, $message = '')
    {
        if (!\enum_exists($value)) {
            static::reportInvalidArgument(\sprintf(
                $message ?: 'Expected an existing enum name. Got: %s',
                static::valueToString($value),
            ));
        }
    }

    /**
     * {@inheritDoc}
     *
     * En plus du fonctionnement de base, ajoute la prise en charge des `collections`.
     */
    public static function notEmpty($value, $message = '')
    {
        if ($value instanceof Collection) {
            // @phpstan-ignore-next-line possiblyImpure.methodCall
            if ($value->isEmpty()) {
                static::reportInvalidArgument(\sprintf(
                    $message ?: 'Expected a non-empty collection.',
                    // @phpstan-ignore-next-line possiblyImpure.methodCall
                    static::valueToString($value),
                ));
            }
            return;
        }

        parent::notEmpty($value, $message);
    }
}
