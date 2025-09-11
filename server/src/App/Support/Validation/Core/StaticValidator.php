<?php
declare(strict_types=1);

namespace Loxya\Support\Validation\Core;

use Loxya\Support\Validation\ChainedValidator as ChainedValidatorExtended;
use Respect\Validation\Rules\Key;
use Respect\Validation\Validatable;

interface StaticValidator
{
    public static function allOf(Validatable ...$rule): ChainedValidatorExtended;

    public static function alnum(string ...$additionalChars): ChainedValidatorExtended;

    public static function alpha(string ...$additionalChars): ChainedValidatorExtended;

    public static function alwaysInvalid(): ChainedValidatorExtended;

    public static function alwaysValid(): ChainedValidatorExtended;

    public static function anyOf(Validatable ...$rule): ChainedValidatorExtended;

    public static function arrayType(): ChainedValidatorExtended;

    public static function arrayVal(): ChainedValidatorExtended;

    public static function attribute(
        string $reference,
        ?Validatable $validator = null,
        bool $mandatory = true,
    ): ChainedValidatorExtended;

    public static function base(int $base, ?string $chars = null): ChainedValidatorExtended;

    public static function base64(): ChainedValidatorExtended;

    public static function between(mixed $minimum, mixed $maximum): ChainedValidatorExtended;

    public static function boolType(): ChainedValidatorExtended;

    public static function boolVal(): ChainedValidatorExtended;

    public static function bsn(): ChainedValidatorExtended;

    public static function call(callable $callable, Validatable $rule): ChainedValidatorExtended;

    public static function callableType(): ChainedValidatorExtended;

    public static function callback(callable $callback): ChainedValidatorExtended;

    public static function charset(string ...$charset): ChainedValidatorExtended;

    public static function cnh(): ChainedValidatorExtended;

    public static function cnpj(): ChainedValidatorExtended;

    public static function control(string ...$additionalChars): ChainedValidatorExtended;

    public static function consonant(string ...$additionalChars): ChainedValidatorExtended;

    public static function contains(mixed $containsValue, bool $identical = false): ChainedValidatorExtended;

    /**
     * @param mixed[] $needles
     */
    public static function containsAny(array $needles, bool $strictCompareArray = false): ChainedValidatorExtended;

    public static function countable(): ChainedValidatorExtended;

    public static function countryCode(?string $set = null): ChainedValidatorExtended;

    public static function currencyCode(): ChainedValidatorExtended;

    public static function cpf(): ChainedValidatorExtended;

    public static function creditCard(?string $brand = null): ChainedValidatorExtended;

    public static function date(string $format = 'Y-m-d'): ChainedValidatorExtended;

    public static function dateTime(?string $format = null): ChainedValidatorExtended;

    public static function decimal(int $decimals): ChainedValidatorExtended;

    public static function digit(string ...$additionalChars): ChainedValidatorExtended;

    public static function directory(): ChainedValidatorExtended;

    public static function domain(bool $tldCheck = true): ChainedValidatorExtended;

    public static function each(Validatable $rule): ChainedValidatorExtended;

    public static function email(): ChainedValidatorExtended;

    public static function endsWith(mixed $endValue, bool $identical = false): ChainedValidatorExtended;

    public static function equals(mixed $compareTo): ChainedValidatorExtended;

    public static function equivalent(mixed $compareTo): ChainedValidatorExtended;

    public static function even(): ChainedValidatorExtended;

    public static function executable(): ChainedValidatorExtended;

    public static function exists(): ChainedValidatorExtended;

    public static function extension(string $extension): ChainedValidatorExtended;

    public static function factor(int $dividend): ChainedValidatorExtended;

    public static function falseVal(): ChainedValidatorExtended;

    public static function fibonacci(): ChainedValidatorExtended;

    public static function file(): ChainedValidatorExtended;

    /**
     * @param mixed[]|int $options
     */
    public static function filterVar(int $filter, $options = null): ChainedValidatorExtended;

    public static function finite(): ChainedValidatorExtended;

    public static function floatVal(): ChainedValidatorExtended;

    public static function floatType(): ChainedValidatorExtended;

    public static function graph(string ...$additionalChars): ChainedValidatorExtended;

    public static function greaterThan(mixed $compareTo): ChainedValidatorExtended;

    public static function hexRgbColor(): ChainedValidatorExtended;

    public static function iban(): ChainedValidatorExtended;

    public static function identical(mixed $compareTo): ChainedValidatorExtended;

    public static function image(?\finfo $fileInfo = null): ChainedValidatorExtended;

    public static function imei(): ChainedValidatorExtended;

    /**
     * @param mixed[]|mixed $haystack
     */
    public static function in($haystack, bool $compareIdentical = true): ChainedValidatorExtended;

    public static function infinite(): ChainedValidatorExtended;

    public static function instance(string $instanceName): ChainedValidatorExtended;

    public static function intVal(): ChainedValidatorExtended;

    public static function intType(): ChainedValidatorExtended;

    public static function ip(string $range = '*', ?int $options = null): ChainedValidatorExtended;

    public static function isbn(): ChainedValidatorExtended;

    public static function iterableType(): ChainedValidatorExtended;

    public static function json(): ChainedValidatorExtended;

    public static function key(
        string $reference,
        ?Validatable $referenceValidator = null,
        bool $mandatory = true,
    ): ChainedValidatorExtended;

    public static function keyNested(
        string $reference,
        ?Validatable $referenceValidator = null,
        bool $mandatory = true,
    ): ChainedValidatorExtended;

    public static function keySet(Key ...$rule): ChainedValidatorExtended;

    public static function keyValue(string $comparedKey, string $ruleName, string $baseKey): ChainedValidatorExtended;

    public static function languageCode(?string $set = null): ChainedValidatorExtended;

    public static function leapDate(string $format): ChainedValidatorExtended;

    public static function leapYear(): ChainedValidatorExtended;

    public static function length(?int $min = null, ?int $max = null, bool $inclusive = true): ChainedValidatorExtended;

    public static function lowercase(): ChainedValidatorExtended;

    public static function lessThan(mixed $compareTo): ChainedValidatorExtended;

    public static function luhn(): ChainedValidatorExtended;

    public static function macAddress(): ChainedValidatorExtended;

    public static function max(mixed $compareTo): ChainedValidatorExtended;

    public static function maxAge(int $age, ?string $format = null): ChainedValidatorExtended;

    public static function mimetype(string $mimetype): ChainedValidatorExtended;

    public static function min(mixed $compareTo): ChainedValidatorExtended;

    public static function minAge(int $age, ?string $format = null): ChainedValidatorExtended;

    public static function multiple(int $multipleOf): ChainedValidatorExtended;

    public static function negative(): ChainedValidatorExtended;

    public static function nfeAccessKey(): ChainedValidatorExtended;

    public static function nif(): ChainedValidatorExtended;

    public static function nip(): ChainedValidatorExtended;

    public static function no(bool $useLocale = false): ChainedValidatorExtended;

    public static function noneOf(Validatable ...$rule): ChainedValidatorExtended;

    public static function not(Validatable $rule): ChainedValidatorExtended;

    public static function notBlank(): ChainedValidatorExtended;

    public static function notEmoji(): ChainedValidatorExtended;

    public static function notEmpty(): ChainedValidatorExtended;

    public static function notOptional(): ChainedValidatorExtended;

    public static function noWhitespace(): ChainedValidatorExtended;

    public static function nullable(Validatable $rule): ChainedValidatorExtended;

    public static function nullType(): ChainedValidatorExtended;

    public static function number(): ChainedValidatorExtended;

    public static function numericVal(): ChainedValidatorExtended;

    public static function objectType(): ChainedValidatorExtended;

    public static function odd(): ChainedValidatorExtended;

    public static function oneOf(Validatable ...$rule): ChainedValidatorExtended;

    public static function optional(Validatable $rule): ChainedValidatorExtended;

    public static function perfectSquare(): ChainedValidatorExtended;

    public static function pesel(): ChainedValidatorExtended;

    public static function phone(?string $countryCode = null): ChainedValidatorExtended;

    public static function phpLabel(): ChainedValidatorExtended;

    public static function pis(): ChainedValidatorExtended;

    public static function polishIdCard(): ChainedValidatorExtended;

    public static function portugueseNif(): ChainedValidatorExtended;

    public static function positive(): ChainedValidatorExtended;

    public static function postalCode(string $countryCode): ChainedValidatorExtended;

    public static function primeNumber(): ChainedValidatorExtended;

    public static function printable(string ...$additionalChars): ChainedValidatorExtended;

    public static function publicDomainSuffix(): ChainedValidatorExtended;

    public static function punct(string ...$additionalChars): ChainedValidatorExtended;

    public static function readable(): ChainedValidatorExtended;

    public static function regex(string $regex): ChainedValidatorExtended;

    public static function resourceType(): ChainedValidatorExtended;

    public static function roman(): ChainedValidatorExtended;

    public static function scalarVal(): ChainedValidatorExtended;

    public static function size(?string $minSize = null, ?string $maxSize = null): ChainedValidatorExtended;

    public static function slug(): ChainedValidatorExtended;

    public static function sorted(string $direction): ChainedValidatorExtended;

    public static function space(string ...$additionalChars): ChainedValidatorExtended;

    public static function startsWith(mixed $startValue, bool $identical = false): ChainedValidatorExtended;

    public static function stringType(): ChainedValidatorExtended;

    public static function stringVal(): ChainedValidatorExtended;

    public static function subdivisionCode(string $countryCode): ChainedValidatorExtended;

    /**
     * @param mixed[] $superset
     */
    public static function subset(array $superset): ChainedValidatorExtended;

    public static function symbolicLink(): ChainedValidatorExtended;

    public static function time(string $format = 'H:i:s'): ChainedValidatorExtended;

    public static function tld(): ChainedValidatorExtended;

    public static function trueVal(): ChainedValidatorExtended;

    public static function type(string $type): ChainedValidatorExtended;

    public static function unique(): ChainedValidatorExtended;

    public static function uploaded(): ChainedValidatorExtended;

    public static function uppercase(): ChainedValidatorExtended;

    public static function url(): ChainedValidatorExtended;

    public static function uuid(?int $version = null): ChainedValidatorExtended;

    public static function version(): ChainedValidatorExtended;

    public static function videoUrl(?string $service = null): ChainedValidatorExtended;

    public static function vowel(string ...$additionalChars): ChainedValidatorExtended;

    public static function when(
        Validatable $if,
        Validatable $then,
        ?Validatable $else = null,
    ): ChainedValidatorExtended;

    public static function writable(): ChainedValidatorExtended;

    public static function xdigit(string ...$additionalChars): ChainedValidatorExtended;

    public static function yes(bool $useLocale = false): ChainedValidatorExtended;
}
