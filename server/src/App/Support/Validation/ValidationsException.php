<?php
declare(strict_types=1);

namespace Loxya\Support\Validation;

class ValidationsException extends \RuntimeException
{
    private array $validationErrors;

    /**
     * @param array $validationErrors Les erreurs de validation.
     */
    public function __construct(array $validationErrors = [])
    {
        $this->validationErrors = $validationErrors;

        parent::__construct("Validation failed.");
    }

    // ------------------------------------------------------
    // -
    // -    Getters
    // -
    // ------------------------------------------------------

    public function getValidationErrors(): array
    {
        return $this->validationErrors;
    }
}
