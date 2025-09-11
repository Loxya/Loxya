<?php
declare(strict_types=1);

namespace Loxya\Support\Validation\Core;

use Loxya\Support\Validation\ChainedValidator as ChainedValidatorExtended;
use Respect\Validation\Rules\Key;
use Respect\Validation\Validatable;

interface ChainedValidator extends Validatable
{
    public function allOf(Validatable ...$rule): ChainedValidatorExtended;

    public function alnum(string ...$additionalChars): ChainedValidatorExtended;

    public function alpha(string ...$additionalChars): ChainedValidatorExtended;

    public function alwaysInvalid(): ChainedValidatorExtended;

    public function alwaysValid(): ChainedValidatorExtended;

    public function anyOf(Validatable ...$rule): ChainedValidatorExtended;

    public function arrayType(): ChainedValidatorExtended;

    public function arrayVal(): ChainedValidatorExtended;

    public function attribute(
        string $reference,
        ?Validatable $validator = null,
        bool $mandatory = true,
    ): ChainedValidatorExtended;

    public function base(int $base, ?string $chars = null): ChainedValidatorExtended;

    public function base64(): ChainedValidatorExtended;

    public function between(mixed $minimum, mixed $maximum): ChainedValidatorExtended;

    public function boolType(): ChainedValidatorExtended;

    public function boolVal(): ChainedValidatorExtended;

    public function bsn(): ChainedValidatorExtended;

    public function call(callable $callable, Validatable $rule): ChainedValidatorExtended;

    public function callableType(): ChainedValidatorExtended;

    public function callback(callable $callback): ChainedValidatorExtended;

    public function charset(string ...$charset): ChainedValidatorExtended;

    public function cnh(): ChainedValidatorExtended;

    public function cnpj(): ChainedValidatorExtended;

    public function control(string ...$additionalChars): ChainedValidatorExtended;

    public function consonant(string ...$additionalChars): ChainedValidatorExtended;

    public function contains(mixed $containsValue, bool $identical = false): ChainedValidatorExtended;

    /**
     * @param mixed[] $needles
     */
    public function containsAny(array $needles, bool $strictCompareArray = false): ChainedValidatorExtended;

    public function countable(): ChainedValidatorExtended;

    public function countryCode(?string $set = null): ChainedValidatorExtended;

    public function currencyCode(): ChainedValidatorExtended;

    public function cpf(): ChainedValidatorExtended;

    public function creditCard(?string $brand = null): ChainedValidatorExtended;

    public function date(string $format = 'Y-m-d'): ChainedValidatorExtended;

    public function dateTime(?string $format = null): ChainedValidatorExtended;

    public function decimal(int $decimals): ChainedValidatorExtended;

    public function digit(string ...$additionalChars): ChainedValidatorExtended;

    public function directory(): ChainedValidatorExtended;

    public function domain(bool $tldCheck = true): ChainedValidatorExtended;

    public function each(Validatable $rule): ChainedValidatorExtended;

    public function email(): ChainedValidatorExtended;

    public function endsWith(mixed $endValue, bool $identical = false): ChainedValidatorExtended;

    public function equals(mixed $compareTo): ChainedValidatorExtended;

    public function equivalent(mixed $compareTo): ChainedValidatorExtended;

    public function even(): ChainedValidatorExtended;

    public function executable(): ChainedValidatorExtended;

    public function exists(): ChainedValidatorExtended;

    public function extension(string $extension): ChainedValidatorExtended;

    public function factor(int $dividend): ChainedValidatorExtended;

    public function falseVal(): ChainedValidatorExtended;

    public function fibonacci(): ChainedValidatorExtended;

    public function file(): ChainedValidatorExtended;

    /**
     * @param mixed[]|int $options
     */
    public function filterVar(int $filter, $options = null): ChainedValidatorExtended;

    public function finite(): ChainedValidatorExtended;

    public function floatVal(): ChainedValidatorExtended;

    public function floatType(): ChainedValidatorExtended;

    public function graph(string ...$additionalChars): ChainedValidatorExtended;

    public function greaterThan(mixed $compareTo): ChainedValidatorExtended;

    public function hexRgbColor(): ChainedValidatorExtended;

    public function iban(): ChainedValidatorExtended;

    public function identical(mixed $compareTo): ChainedValidatorExtended;

    public function image(?\finfo $fileInfo = null): ChainedValidatorExtended;

    public function imei(): ChainedValidatorExtended;

    /**
     * @param mixed[]|mixed $haystack
     */
    public function in($haystack, bool $compareIdentical = true): ChainedValidatorExtended;

    public function infinite(): ChainedValidatorExtended;

    public function instance(string $instanceName): ChainedValidatorExtended;

    public function intVal(): ChainedValidatorExtended;

    public function intType(): ChainedValidatorExtended;

    public function ip(string $range = '*', ?int $options = null): ChainedValidatorExtended;

    public function isbn(): ChainedValidatorExtended;

    public function iterableType(): ChainedValidatorExtended;

    public function json(): ChainedValidatorExtended;

    public function key(
        string $reference,
        ?Validatable $referenceValidator = null,
        bool $mandatory = true,
    ): ChainedValidatorExtended;

    public function keyNested(
        string $reference,
        ?Validatable $referenceValidator = null,
        bool $mandatory = true,
    ): ChainedValidatorExtended;

    public function keySet(Key ...$rule): ChainedValidatorExtended;

    public function keyValue(string $comparedKey, string $ruleName, string $baseKey): ChainedValidatorExtended;

    public function languageCode(?string $set = null): ChainedValidatorExtended;

    public function leapDate(string $format): ChainedValidatorExtended;

    public function leapYear(): ChainedValidatorExtended;

    public function length(?int $min = null, ?int $max = null, bool $inclusive = true): ChainedValidatorExtended;

    public function lowercase(): ChainedValidatorExtended;

    public function lessThan(mixed $compareTo): ChainedValidatorExtended;

    public function luhn(): ChainedValidatorExtended;

    public function macAddress(): ChainedValidatorExtended;

    public function max(mixed $compareTo): ChainedValidatorExtended;

    public function maxAge(int $age, ?string $format = null): ChainedValidatorExtended;

    public function mimetype(string $mimetype): ChainedValidatorExtended;

    public function min(mixed $compareTo): ChainedValidatorExtended;

    public function minAge(int $age, ?string $format = null): ChainedValidatorExtended;

    public function multiple(int $multipleOf): ChainedValidatorExtended;

    public function negative(): ChainedValidatorExtended;

    public function nfeAccessKey(): ChainedValidatorExtended;

    public function nif(): ChainedValidatorExtended;

    public function nip(): ChainedValidatorExtended;

    public function no(bool $useLocale = false): ChainedValidatorExtended;

    public function noneOf(Validatable ...$rule): ChainedValidatorExtended;

    public function not(Validatable $rule): ChainedValidatorExtended;

    public function notBlank(): ChainedValidatorExtended;

    public function notEmoji(): ChainedValidatorExtended;

    public function notEmpty(): ChainedValidatorExtended;

    public function notOptional(): ChainedValidatorExtended;

    public function noWhitespace(): ChainedValidatorExtended;

    public function nullable(Validatable $rule): ChainedValidatorExtended;

    public function nullType(): ChainedValidatorExtended;

    public function number(): ChainedValidatorExtended;

    public function numericVal(): ChainedValidatorExtended;

    public function objectType(): ChainedValidatorExtended;

    public function odd(): ChainedValidatorExtended;

    public function oneOf(Validatable ...$rule): ChainedValidatorExtended;

    public function optional(Validatable $rule): ChainedValidatorExtended;

    public function perfectSquare(): ChainedValidatorExtended;

    public function pesel(): ChainedValidatorExtended;

    public function phone(?string $countryCode = null): ChainedValidatorExtended;

    public function phpLabel(): ChainedValidatorExtended;

    public function pis(): ChainedValidatorExtended;

    public function polishIdCard(): ChainedValidatorExtended;

    public function portugueseNif(): ChainedValidatorExtended;

    public function positive(): ChainedValidatorExtended;

    public function postalCode(string $countryCode): ChainedValidatorExtended;

    public function primeNumber(): ChainedValidatorExtended;

    public function printable(string ...$additionalChars): ChainedValidatorExtended;

    public function publicDomainSuffix(): ChainedValidatorExtended;

    public function punct(string ...$additionalChars): ChainedValidatorExtended;

    public function readable(): ChainedValidatorExtended;

    public function regex(string $regex): ChainedValidatorExtended;

    public function resourceType(): ChainedValidatorExtended;

    public function roman(): ChainedValidatorExtended;

    public function scalarVal(): ChainedValidatorExtended;

    public function size(?string $minSize = null, ?string $maxSize = null): ChainedValidatorExtended;

    public function slug(): ChainedValidatorExtended;

    public function sorted(string $direction): ChainedValidatorExtended;

    public function space(string ...$additionalChars): ChainedValidatorExtended;

    public function startsWith(mixed $startValue, bool $identical = false): ChainedValidatorExtended;

    public function stringType(): ChainedValidatorExtended;

    public function stringVal(): ChainedValidatorExtended;

    public function subdivisionCode(string $countryCode): ChainedValidatorExtended;

    /**
     * @param mixed[] $superset
     */
    public function subset(array $superset): ChainedValidatorExtended;

    public function symbolicLink(): ChainedValidatorExtended;

    public function time(string $format = 'H:i:s'): ChainedValidatorExtended;

    public function tld(): ChainedValidatorExtended;

    public function trueVal(): ChainedValidatorExtended;

    public function type(string $type): ChainedValidatorExtended;

    public function unique(): ChainedValidatorExtended;

    public function uploaded(): ChainedValidatorExtended;

    public function uppercase(): ChainedValidatorExtended;

    public function url(): ChainedValidatorExtended;

    public function uuid(?int $version = null): ChainedValidatorExtended;

    public function version(): ChainedValidatorExtended;

    public function videoUrl(?string $service = null): ChainedValidatorExtended;

    public function vowel(string ...$additionalChars): ChainedValidatorExtended;

    public function when(Validatable $if, Validatable $then, ?Validatable $else = null): ChainedValidatorExtended;

    public function writable(): ChainedValidatorExtended;

    public function xdigit(string ...$additionalChars): ChainedValidatorExtended;

    public function yes(bool $useLocale = false): ChainedValidatorExtended;
}
