<?php
declare(strict_types=1);

namespace Loxya\Support\Validation\Rules;

use Egulias\EmailValidator\EmailValidator;
use Egulias\EmailValidator\Validation\DNSCheckValidation;
use Egulias\EmailValidator\Validation\MultipleValidationWithAnd;
use Egulias\EmailValidator\Validation\RFCValidation;
use Respect\Validation\Rules\AbstractRule;

final class Email extends AbstractRule
{
    private $checkDns;

    public function __construct(bool $checkDns = false)
    {
        $this->checkDns = $checkDns;
    }

    public function validate($input): bool
    {
        if (!is_string($input)) {
            return false;
        }

        $rules = [new RFCValidation()];

        if ($this->checkDns) {
            $rules[] = new DNSCheckValidation();
        }

        $validator = new EmailValidator();
        return $validator->isValid($input, new MultipleValidationWithAnd($rules));
    }
}
