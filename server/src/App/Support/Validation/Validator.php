<?php
declare(strict_types=1);

namespace Loxya\Support\Validation;

use Respect\Validation\Exceptions\ValidationException as CoreValidationException;
use Respect\Validation\Factory;
use Respect\Validation\Rules\AllOf;

/**
 * @mixin StaticValidator
 */
final class Validator extends AllOf
{
    public static function create(): self
    {
        return new self();
    }

    /**
     * {@inheritDoc}
     */
    public function check($input): void
    {
        try {
            parent::check($input);
        } catch (CoreValidationException $exception) {
            if (count($this->getRules()) === 1 && $this->template) {
                $exception->updateTemplate($this->template);
            }

            throw $exception;
        }
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
