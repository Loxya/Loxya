<?php
declare(strict_types=1);

namespace Loxya\Support\Validation\Rules;

use Respect\Validation\Exceptions\AllOfException;
use Respect\Validation\Exceptions\ValidationException;
use Respect\Validation\Helpers\CanValidateIterable;
use Respect\Validation\NonNegatable;
use Respect\Validation\Rules\AbstractRule;
use Respect\Validation\Rules\AllOf;
use Respect\Validation\Rules\Key;
use Respect\Validation\Validatable;

final class Each extends AbstractRule implements NonNegatable
{
    use CanValidateIterable;

    private Validatable $rule;

    public function __construct(Validatable $rule)
    {
        $this->rule = $rule;
    }

    public function assert($input): void
    {
        if (!$this->isIterable($input)) {
            throw $this->reportError($input);
        }

        $exceptions = [];
        foreach ($input as $key => $value) {
            try {
                (new Key((string) $key, $this->rule))
                    ->assert([(string) $key => $value]);
            } catch (ValidationException $exception) {
                $exceptions[] = $exception;
            }
        }

        if (!empty($exceptions)) {
            $total = is_countable($input) ? count($input) : count($exceptions);

            /** @var AllOfException $allOfException */
            $allOfException = (new AllOf())->reportError($input, [
                'total' => $total,
                'failed' => count($exceptions),
                'passed' => $total - count($exceptions),
            ]);
            $allOfException->addChildren($exceptions);
            throw $allOfException;
        }
    }

    public function check($input): void
    {
        if (!$this->isIterable($input)) {
            throw $this->reportError($input);
        }

        foreach ($input as $key => $value) {
            (new Key((string) $key, $this->rule))
                ->check([(string) $key => $value]);
        }
    }

    public function validate($input): bool
    {
        if (!$this->isIterable($input)) {
            return false;
        }

        foreach ($input as $value) {
            if (!$this->rule->validate($value)) {
                return false;
            }
        }

        return true;
    }
}
