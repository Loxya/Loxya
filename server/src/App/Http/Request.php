<?php
declare(strict_types=1);

namespace Loxya\Http;

use BackedEnum;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use DateTimeInterface;
use DateTimeZone;
use Loxya\Config\Config;
use Loxya\Http\Enums\AppContext;
use Loxya\Models\BaseModel;
use Loxya\Support\Assert;
use Loxya\Support\Period;
use Loxya\Support\Str;
use Slim\Http\ServerRequest as CoreRequest;

class Request extends CoreRequest
{
    /**
     * Retourne le contexte de la requête.
     *
     * @return AppContext Le contexte de la requête.
     */
    public function getContext(): AppContext
    {
        return AppContext::INTERNAL;
    }

    /**
     * La requête est t'elle à destination de l'API ?
     *
     * @return bool `true` si c'est une requête d'API, `false` sinon.
     */
    public function isApi(): bool
    {
        return $this->match('/api');
    }

    /**
     * La requête est t'elle dans le context fourni ?
     *
     * @param AppContext $context Le contexte à vérifier.
     *
     * @return bool `true` si on est dans le contexte, `false` sinon.
     */
    public function isInContext(AppContext $context): bool
    {
        return $this->getContext() === $context;
    }

    /**
     * Permet de vérifier si le chemin de la requête courante correspond au(x) chemin(s) passés.
     *
     * @param array|string $paths - Le ou les chemins à vérifier.
     *                              Si c'est un tableau, le chemin courant doit correspondre à
     *                              au moins une des entrées. Ce tableau peut contenir une liste
     *                              d'URL simples ou bien contenir en clé l'URL et en valeur des
     *                              méthodes requises pour que l'URL soit considérée comme
     *                              correspondante.
     *
     * @return bool `true` si la requête correspond, `false` sinon.
     */
    public function match(string|array $paths): bool
    {
        $requestMethod = $this->getMethod();
        $requestPath = str_replace('//', '/', sprintf('/%s', $this->getUri()->getPath()));

        foreach ((array) $paths as $path => $methods) {
            if (is_numeric($path)) {
                $path = $methods;
                $methods = null;
            }

            $exact = substr($path, -1) === '$';
            $path = rtrim(rtrim(Config::getBaseUri()->withPath($path)->getPath(), '$'), '/');
            $isMethodMatching = $methods === null || in_array($requestMethod, (array) $methods, true);
            $isUriMatching = (bool) preg_match(
                sprintf('@^%s%s@', preg_quote($path, '@'), $exact ? '/?$' : '(?:/|$)'),
                $requestPath,
            );

            if ($isUriMatching && $isMethodMatching) {
                return true;
            }
        }

        return false;
    }

    /**
     * Récupère un attribut sous forme d'entier.
     *
     * @param string $key La clé dans laquelle se trouve l'attribut à récupérer.
     *
     * @return int L'attribut sous forme de valeur entière.
     */
    public function getIntegerAttribute(string $key): int
    {
        $rawValue = $this->getAttribute($key, null);
        if ($rawValue === null) {
            throw new \LogicException(sprintf('Unexpected unknown integer attribute `%s`.', $key));
        }
        return intval($rawValue);
    }

    /**
     * Récupère un attribut sous forme de valeur d'énumération.
     *
     * @template T of BackedEnum
     *
     * @param string          $key       La clé dans laquelle se trouve l'attribut à récupérer.
     * @param class-string<T> $enumClass La classe d'énumération.
     *
     * @return T La valeur d'énumération.
     */
    public function getEnumAttribute(string $key, string $enumClass): BackedEnum
    {
        Assert::enumExists($enumClass, 'Unknown enum class `%s`.');
        Assert::isAOf($enumClass, BackedEnum::class, 'Enum class should be a backed enum.');

        $rawValue = $this->getAttribute($key, null);
        $value = $rawValue !== null ? $enumClass::tryFrom($rawValue) : null;
        if ($value === null) {
            throw new \LogicException(sprintf('Unexpected unknown enum attribute `%s`.', $key));
        }
        return $value;
    }

    /**
     * Récupère un attribut sous forme de valeur brute d'énumération.
     *
     * Une valeur brute d'énumération est une valeur valide parmi une liste donnée.
     *
     * @template T of mixed
     *
     * @param string $key  La clé dans laquelle se trouve le paramètre à récupérer.
     * @param T[]    $enum Les valeurs valides de l'énumération.
     *
     * @return T La valeur brute d'énumération.
     */
    public function getRawEnumAttribute(string $key, array $enum): mixed
    {
        $rawValue = $this->getAttribute($key, null);
        if ($rawValue === null || !in_array($rawValue, $enum, true)) {
            throw new \LogicException(sprintf('Unexpected unknown raw enum attribute `%s`.', $key));
        }
        return $rawValue;
    }

    /**
     * Récupère un paramètre de requête sous forme booléenne.
     *
     * Retourne `true` si la valeur est "1", "true", "on" ou "yes" ou que le paramètre
     * est passé sans valeur (e.g. `?param`). Sinon, retourne `false`.
     *
     * @template D of bool|null
     *
     * @param string $key     La clé dans laquelle se trouve le paramètre à récupérer.
     * @param D      $default La valeur par défaut si le paramètre n'existe pas.
     *
     * @return bool|D La valeur booléenne (ou `null` si c'est la valeur par défaut).
     */
    public function getBooleanQueryParam(string $key, bool|null $default = false): bool|null
    {
        $rawValue = $this->getQueryParam($key, null);

        // - Si le query-param est passé sous la forme `?param` (sans valeur)...
        //   => On considère que sa valeur vaut `true`.
        $rawValue = $rawValue === '' ? true : $rawValue;

        return $rawValue !== null
            ? filter_var($rawValue, FILTER_VALIDATE_BOOLEAN)
            : $default;
    }

    /**
     * Récupère un paramètre de requête sous forme de chaîne (ou `null` si c'est la valeur par défaut).
     *
     * @template D of string|null
     *
     * @param string $key     La clé dans laquelle se trouve le paramètre à récupérer.
     * @param D      $default La valeur par défaut si le paramètre n'existe pas.
     *
     * @return string|D La chaîne résultante (ou `null` si c'est la valeur par défaut).
     */
    public function getStringQueryParam(string $key, string|null $default = null): string|null
    {
        $rawValue = $this->getQueryParam($key, null);
        return $rawValue !== null && is_string($rawValue) ? trim($rawValue) : $default;
    }

    /**
     * Récupère un paramètre de requête sous forme de tableau de chaînes.
     *
     * @template D of string[]
     *
     * @param string $key     La clé dans laquelle se trouve le paramètre à récupérer.
     * @param D      $default La valeur par défaut si le paramètre n'existe pas.
     *
     * @return string[]|D Le tableau de chaînes résultant.
     */
    public function getStringArrayQueryParam(string $key, array $default = []): array
    {
        $rawValues = $this->getQueryParam($key, null);
        if ($rawValues === null) {
            return $default;
        }

        $rawValues = !is_array($rawValues) ? [$rawValues] : $rawValues;
        return array_map(
            static fn($rawValue) => trim($rawValue),
            array_filter($rawValues, 'is_string'),
        );
    }

    /**
     * Récupère un paramètre de requête sous forme de tableau de chaînes de recherche.
     *
     * @param string $key La clé dans laquelle se trouve le paramètre à récupérer.
     *
     * @return string[] Le tableau de chaînes de recherche résultant.
     */
    public function getSearchArrayQueryParam(string $key): array
    {
        return array_filter(
            $this->getStringArrayQueryParam($key),
            static fn($searchTerm) => mb_strlen($searchTerm) >= 2,
        );
    }

    /**
     * Récupère un paramètre de requête sous forme de valeur entière
     * (ou `null` si c'est la valeur par défaut).
     *
     * @template D of int|null
     *
     * @param string $key     La clé dans laquelle se trouve le paramètre à récupérer.
     * @param D      $default La valeur par défaut si le paramètre n'existe pas.
     *
     * @return int|D La valeur entière (ou `null` si c'est la valeur par défaut).
     */
    public function getIntegerQueryParam(string $key, int|null $default = null): int|null
    {
        $rawValue = $this->getQueryParam($key, null);
        return $rawValue !== null && is_numeric($rawValue) ? intval($rawValue) : $default;
    }

    /**
     * Récupère un paramètre de requête sous forme de tableau d'entiers.
     *
     * @template D of int[]
     *
     * @param string $key     La clé dans laquelle se trouve le paramètre à récupérer.
     * @param D      $default La valeur par défaut si le paramètre n'existe pas.
     *
     * @return int[]|D Le tableau d'entiers résultant.
     */
    public function getIntegerArrayQueryParam(string $key, array $default = []): array
    {
        $rawValues = $this->getQueryParam($key, null);
        if ($rawValues === null) {
            return $default;
        }

        $rawValues = !is_array($rawValues) ? [$rawValues] : $rawValues;
        return array_map(
            static fn($rawValue) => intval($rawValue),
            array_filter($rawValues, 'is_numeric'),
        );
    }

    /**
     * Récupère un paramètre de requête sous forme de date
     * (ou `null` si c'est la valeur par défaut).
     *
     * @param string                        $key     La clé dans laquelle se trouve le paramètre à récupérer.
     * @param string|DateTimeInterface|null $default La valeur par défaut si le paramètre n'existe pas.
     * @param DateTimeZone|string|null      $tz      Le fuseau horaire à utiliser pour la valeur / valeur par défaut.
     *
     * @return CarbonInterface|null La date (ou `null` si c'est la valeur par défaut).
     */
    public function getDateQueryParam(
        string $key,
        string|DateTimeInterface|null $default = null,
        DateTimeZone|string|null $tz = null,
    ): CarbonInterface|null {
        $rawValue = $this->getQueryParam($key, null);
        if ($rawValue !== null) {
            try {
                return Carbon::parse($rawValue, $tz);
            } catch (\Throwable) {
                // - Default value.
            }
        }
        return $default !== null ? Carbon::parse($default, $tz) : null;
    }

    /**
     * Récupère un paramètre de requête sous forme de période
     * (ou `null` si c'est la valeur par défaut).
     *
     * @template D of Period|null
     *
     * @param string $key     La clé dans laquelle se trouve le paramètre à récupérer.
     * @param D      $default La valeur par défaut si le paramètre n'existe pas.
     *
     * @return Period|D La période (ou `null` si c'est la valeur par défaut).
     */
    public function getPeriodQueryParam(string $key, Period|null $default = null): Period|null
    {
        $rawValue = $this->getQueryParam($key, null);
        if ($rawValue !== null && is_array($rawValue)) {
            try {
                $computedPeriod = Period::fromArray($rawValue);
                if (!$computedPeriod->isInfinite()) {
                    return $computedPeriod;
                }
            } catch (\Throwable) {
                // - Default value.
            }
        }
        return $default !== null ? new Period($default) : null;
    }

    /**
     * Récupère un paramètre de requête sous forme de valeur brute d'énumération
     * (ou `null` si c'est la valeur par défaut).
     *
     * Une valeur brute d'énumération est une valeur valide parmi une liste donnée.
     *
     * @template T of mixed
     * @template D of mixed|null
     *
     * @param string $key     La clé dans laquelle se trouve le paramètre à récupérer.
     * @param T[]    $enum    Les valeurs valides de l'énumération.
     * @param D      $default La valeur par défaut si le paramètre n'existe pas.
     *
     * @return T|D La valeur brute d'énumération (ou `null` si c'est la valeur par défaut).
     */
    public function getRawEnumQueryParam(string $key, array $enum, mixed $default = null): mixed
    {
        Assert::nullOrInArray($default, $enum, 'Default value should be present in enum values (or `null`).');

        $rawValue = $this->getQueryParam($key, null);
        return in_array($rawValue, $enum, true) ? $rawValue : $default;
    }

    /**
     * Récupère un paramètre de requête sous forme de valeur d'énumération
     * (ou `null` si c'est la valeur par défaut).
     *
     * @template T of BackedEnum
     * @template D of BackedEnum|null
     *
     * @param string          $key       La clé dans laquelle se trouve le paramètre à récupérer.
     * @param class-string<T> $enumClass La classe d'énumération.
     * @param D               $default   La valeur par défaut si le paramètre n'existe pas.
     *
     * @return T|D La valeur d'énumération (ou `null` si c'est la valeur par défaut).
     */
    public function getEnumQueryParam(string $key, string $enumClass, BackedEnum|null $default = null): BackedEnum|null
    {
        Assert::enumExists($enumClass, 'Unknown enum class `%s`.');
        Assert::isAOf($enumClass, BackedEnum::class, 'Enum class should be a backed enum.');
        Assert::nullOrIsInstanceOf($default, $enumClass, 'Default value should be a member of the enum (or `null`).');

        $rawValue = $this->getQueryParam($key, null);
        if ($rawValue === null) {
            return $default;
        }

        return $enumClass::tryFrom($rawValue) ?? $default;
    }

    /**
     * Récupère un paramètre de requête sous forme de valeur
     * valide pour un `order by` d'un modèle donné.
     *
     * Si le paramètre de requête est invalide, un appel à `getDefaultOrderColumn()`
     * sur le modèle spécifié sera effectué et la valeur retournée sera utilisée comme
     * valeur par défaut.
     *
     * @param string $key        La clé dans laquelle se trouve le paramètre à récupérer.
     * @param string $modelClass Le modèle pour lequel la colonne `order by` doit être récupérée.
     *
     * @return string|null Le nom de la colonne (ou `null` si c'est la valeur par défaut retournée par le modèle).
     */
    public function getOrderByQueryParam(string $key, string $modelClass): string|null
    {
        Assert::isAOf($modelClass, BaseModel::class, 'Model class should be a model class.');

        /** @var BaseModel $model */
        $model = (new $modelClass());
        $orderableColumns = $model->getOrderableColumns();
        $defaultOrderColumn = $model->getDefaultOrderColumn();

        $rawValue = $this->getQueryParam($key, null);
        if ($rawValue === null) {
            return $defaultOrderColumn;
        }

        return in_array($rawValue, $orderableColumns, true) ? $rawValue : $defaultOrderColumn;
    }

    /**
     * Récupère un champ dans le corps de la requête sous forme de valeur
     * brute d'énumération (ou `null` si c'est la valeur par défaut).
     *
     * Une valeur brute d'énumération est une valeur valide parmi une liste donnée.
     *
     * @template T of mixed
     * @template D of mixed|null
     *
     * @param string $key     La clé dans laquelle se trouve le paramètre à récupérer.
     * @param T[]    $enum    Les valeurs valides de l'énumération.
     * @param D      $default La valeur par défaut si le paramètre n'existe pas.
     *
     * @return T|D La valeur brute d'énumération (ou `null` si c'est la valeur par défaut).
     */
    public function getRawEnumBodyParam(string $key, array $enum, mixed $default = null): mixed
    {
        Assert::nullOrInArray($default, $enum, 'Default value should be present in enum values (or `null`).');

        $rawValue = $this->getParsedBodyParam($key, null);
        if ($rawValue === null) {
            return $default;
        }

        return in_array($rawValue, $enum, true) ? $rawValue : $default;
    }

    /**
     * Récupère un champ dans le corps de la requête sous forme de valeur
     * d'énumération (ou `null` si c'est la valeur par défaut).
     *
     * @template T of BackedEnum
     * @template D of BackedEnum|null
     *
     * @param string          $key       La clé dans laquelle se trouve le paramètre à récupérer.
     * @param class-string<T> $enumClass La classe d'énumération.
     * @param D               $default   La valeur par défaut si le paramètre n'existe pas.
     *
     * @return T|D La valeur d'énumération (ou `null` si c'est la valeur par défaut).
     */
    public function getEnumBodyParam(string $key, string $enumClass, BackedEnum|null $default = null): BackedEnum|null
    {
        Assert::enumExists($enumClass, 'Unknown enum class `%s`.');
        Assert::isAOf($enumClass, BackedEnum::class, 'Enum class should be a backed enum.');
        Assert::nullOrIsInstanceOf($default, $enumClass, 'Default value should be a member of the enum (or `null`).');

        $rawValue = $this->getParsedBodyParam($key, null);
        if ($rawValue === null) {
            return $default;
        }

        return $enumClass::tryFrom($rawValue) ?? $default;
    }

    /**
     * Permet de récupérer l'IP du client si disponible.
     *
     * @return ?string L'IP du client.
     */
    public function getClientIp(): ?string
    {
        return $this->getAttribute('ip');
    }

    /**
     * Vérifie si un en-tête HTTP est présent, en tenant compte d'une forme alternative.
     *
     * Tente d'abord une vérification directe avec `$this->hasHeader($name)`.
     * Si la valeur n'est pas trouvée, essaie de retrouver sa forme transformée dans `$_SERVER`
     * (ex. `X-Guest-Token` devient `HTTP_X_GUEST_TOKEN`).
     *
     * @param string $name Le nom de l'en-tête HTTP (sensible à la casse).
     *
     * @return bool `true` si l'en-tête est présent sous l'une des deux formes, sinon `false`.
     */
    public function hasNormalizedHeader(string $name): bool
    {
        if ($this->hasHeader($name)) {
            return true;
        }

        $fallbackKey = self::getAlternativeHeaderName($name);
        return $this->hasHeader($fallbackKey);
    }

    /**
     * Récupère la valeur d'un en-tête HTTP de manière normalisée.
     *
     * Tente d'abord de lire le header via la méthode standard `$request->getHeaderLine($name)`.
     * Si la valeur n'est pas trouvée, essaie de retrouver sa forme transformée dans `$_SERVER`
     * (ex. `X-Guest-Token` devient `HTTP_X_GUEST_TOKEN`).
     *
     * @see \Slim\Psr7\Request::getHeaderLine()
     *
     * @param string $name Le nom de l'en-tête HTTP (sensible à la casse).
     *
     * @return string La valeur de l'en-tête si trouvée, sinon une chaîne vide.
     */
    public function getNormalizedHeaderLine(string $name): string
    {
        if ($this->hasHeader($name)) {
            return $this->getHeaderLine($name);
        }

        $fallbackKey = self::getAlternativeHeaderName($name);
        return $this->getHeaderLine($fallbackKey);
    }

    /**
     * Génère le nom d'un en-tête HTTP tel qu'il apparaîtrait dans `$_SERVER`.
     * (par exemple `X-Guest-Token` retournera `HTTP_X_GUEST_TOKEN`)
     *
     * @param string $name Le nom original de l'en-tête.
     *
     * @return string Le nom transformé au format `$_SERVER`.
     */
    private static function getAlternativeHeaderName(string $name): string
    {
        return sprintf('HTTP_%s', strtoupper(Str::snake($name)));
    }
}
