<?php
declare(strict_types=1);

namespace Loxya\Support\Validation;

use Loxya\Support\Arr;
use Respect\Validation\Exceptions\AllOfException;
use Respect\Validation\Exceptions\AnyOfException;
use Respect\Validation\Exceptions\KeyException;
use Respect\Validation\Exceptions\NestedValidationException;
use Respect\Validation\Exceptions\NotEmptyException;
use Respect\Validation\Exceptions\OneOfException;
use Respect\Validation\Exceptions\ValidationException as CoreValidationException;
use Respect\Validation\Exceptions\ValidatorException;
use Respect\Validation\Factory;
use Respect\Validation\Rules\AllOf;

/**
 * @mixin StaticValidator
 */
final class Validator extends AllOf implements Validatable
{
    public static function create(): self
    {
        return new self();
    }

    public function setName(string $name): Validatable
    {
        parent::setName($name);

        return $this;
    }

    public function assert($input, ?bool $normalized = false): void
    {
        if (!$normalized) {
            parent::assert($input);
            return;
        }

        try {
            parent::assert($input);
        } catch (NestedValidationException $e) {
            $getErrorMessage = static function (NestedValidationException $exception) use (&$getErrorMessage) {
                $messages = $exception->getMessages();
                if (count($messages) === 1) {
                    return current($messages);
                }

                $rootException = iterator_to_array($exception)[0] ?? null;
                if ($rootException !== null) {
                    switch (get_class($rootException)) {
                        case NotEmptyException::class:
                            return current($messages);

                        case OneOfException::class:
                        case AnyOfException::class:
                            return implode("\n", [
                                array_shift($messages),
                                ...array_map(
                                    static fn ($message) => sprintf('- %s', $message),
                                    $messages,
                                ),
                            ]);

                        case AllOfException::class:
                        case ValidatorException::class:
                            /** @var AllOfException $rootException */

                            $messages = [];
                            $hasKeyedChild = false;
                            foreach ($rootException->getChildren() as $child) {
                                if ($child instanceof KeyException) {
                                    $messages[$child->getParam('reference')] = $getErrorMessage($child);
                                    $hasKeyedChild = true;
                                } else {
                                    $messages[] = $child->getMessage();
                                }
                            }

                            return !$hasKeyedChild && !Arr::isAssoc($messages)
                                ? array_values($messages)[0]
                                : $messages;
                    }
                }

                return implode("\n", array_map(
                    static fn ($message) => sprintf('- %s', $message),
                    $messages,
                ));
            };

            $message = $getErrorMessage($e);
            if (is_array($message)) {
                throw new ValidationsException($message);
            } else {
                throw new ValidationException($message);
            }
        }
    }

    public function check($input, ?bool $normalized = false): void
    {
        try {
            parent::check($input);
        } catch (CoreValidationException $exception) {
            if (count($this->getRules()) === 1 && $this->template) {
                $exception->updateTemplate($this->template);
            }

            if ($normalized) {
                throw new ValidationException($exception->getMessage());
            } else {
                throw $exception;
            }
        }
    }

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
    public function diagnose(mixed $input): string|array|null
    {
        try {
            $this->assert($input, normalized: true);
        } catch (ValidationsException $e) {
            return $e->getValidationErrors();
        } catch (ValidationException $e) {
            return $e->getMessage();
        }
        return null;
    }

    public static function __callStatic(string $ruleName, array $arguments): self
    {
        return self::create()->__call($ruleName, $arguments);
    }

    public function __call(string $ruleName, array $arguments): self
    {
        $this->addRule(Factory::getDefaultInstance()->rule($ruleName, $arguments));

        return $this;
    }
}
