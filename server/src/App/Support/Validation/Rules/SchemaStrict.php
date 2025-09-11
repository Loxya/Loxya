<?php
declare(strict_types=1);

namespace Loxya\Support\Validation\Rules;

use Respect\Validation\Exceptions\ComponentException;
use Respect\Validation\NonNegatable;
use Respect\Validation\Rules\AbstractRule;
use Respect\Validation\Rules\AllOf;
use Respect\Validation\Rules\AlwaysInvalid;
use Respect\Validation\Rules\Key;
use Respect\Validation\Validatable;

/**
 * Permet de valider un schema de façon stricte.
 *
 * Les erreurs sont toujours associées directement aux clés concernées.
 * Ainsi, si une clé inattendue est présente dans le tableau, une erreur
 * est générée **spécifiquement pour cette clé**, et non sous forme
 * d'erreur globale du schéma.
 */
final class SchemaStrict extends AbstractRule implements NonNegatable
{
    /** @var Key[] */
    private array $keyRules;

    public function __construct(Validatable ...$validatables)
    {
        $this->keyRules = array_map([$this, 'getKeyRule'], $validatables);
    }

    /**
     * {@inheritDoc}
     */
    public function assert($input): void
    {
        if (!is_array($input)) {
            throw $this->reportError($input);
        }

        $this->buildValidator($input)->assert($input);
    }

    /**
     * {@inheritDoc}
     */
    public function check($input): void
    {
        if (!is_array($input)) {
            throw $this->reportError($input);
        }

        $this->buildValidator($input)->check($input);
    }

    /**
     * {@inheritDoc}
     */
    public function validate($input): bool
    {
        if (!is_array($input)) {
            return false;
        }

        return $this->buildValidator($input)->validate($input);
    }

    private function getKeyRule(Validatable $validatable): Key
    {
        if ($validatable instanceof Key) {
            return $validatable;
        }

        if (!$validatable instanceof AllOf || count($validatable->getRules()) !== 1) {
            throw new ComponentException('`SchemaStrict` rule accepts only `Key` rules.');
        }

        return $this->getKeyRule(current($validatable->getRules()));
    }

    private function buildValidator($input): AbstractRule
    {
        $keyRules = $this->keyRules;

        // - Schema stricte: Les clés en trop sont toujours invalides.
        $extraKeys = array_diff(array_keys($input), array_map(
            static fn ($keyRule) => $keyRule->getReference(),
            $keyRules,
        ));
        foreach ($extraKeys as $key) {
            $keyRules[] = new Key($key, new AlwaysInvalid(), false);
        }

        //
        // - Validator
        //

        $validator = new AllOf(...$keyRules);

        if ($this->name !== null) {
            $validator->setName($this->name);
        }

        return $validator;
    }
}
