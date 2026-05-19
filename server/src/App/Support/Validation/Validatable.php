<?php
declare(strict_types=1);

namespace Loxya\Support\Validation;

use Respect\Validation\Validatable as CoreValidatable;

interface Validatable extends CoreValidatable
{
    public function setName(string $name): Validatable;

    /**
     * @param mixed $input
     */
    public function assert($input, ?bool $normalized = false): void;

    /**
     * @param mixed $input
     */
    public function check($input, ?bool $normalized = false): void;

    /**
     * Diagnostique les erreurs de validation pour une entrée donnée.
     *
     * @param mixed $input Données à valider.
     *
     * @return string|array<string, string>|null S'il n'y pas d'erreur, retourne `null`.
     *                                           Sinon, le retour dépend du type de validation :
     *                                           - Si c'est un schema, retourne un tableau clé / erreur liée.
     *                                           - Sinon, retourne l'erreur sous forme de chaîne.
     */
    public function diagnose(mixed $input): array|string|null;
}
