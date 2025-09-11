<?php
declare(strict_types=1);

namespace Loxya\Models\Traits;

use LogicException;
use Loxya\Config\Config;
use Loxya\Services\Cache;
use Loxya\Support\Str;
use Symfony\Contracts\Cache\ItemInterface as CacheItemInterface;

trait Caching
{
    public static function getModelCacheKey(): string
    {
        $model = Str::slugify(class_basename(static::class));
        return sprintf('model.%s', $model);
    }

    public function getCacheKey(): string
    {
        if (!$this->id) {
            throw new LogicException("Unable to find the cache key of an entity without an identifier.");
        }
        return sprintf('%s.%d', static::getModelCacheKey(), $this->id);
    }

    public function cacheGet($scope, ?callable $callback = null)
    {
        /** @var Cache $cache */
        $cache = container('cache');

        if (func_num_args() === 1) {
            $callback = $scope;
            $scope = null;
        }

        // - Si dirty, on ne fait pas confiance au cache.
        if ($this->isDirty()) {
            return $callback(null);
        }

        // - Si on est dans un environnement de test, on ne met pas réellement en cache.
        if (Config::getEnv() === 'test') {
            return $callback(null);
        }

        $entityCacheKey = $this->getCacheKey();
        $cacheKey = $scope
            ? sprintf('%s.%s', $entityCacheKey, $scope)
            : $entityCacheKey;

        return $cache->get(
            $cacheKey,
            static function (CacheItemInterface $item) use ($callback, $entityCacheKey, $cacheKey) {
                debug('Creation of the `%s` model cache entry.', $cacheKey);
                $item->tag([static::getModelCacheKey(), $entityCacheKey]);
                return $callback($item);
            },
        );
    }

    /**
     * @param string|array|null $scopes
     */
    public function invalidateCache($scopes = null): bool
    {
        /** @var Cache $cache */
        $cache = container('cache');

        $entityCacheKey = $this->getCacheKey();

        // - Si pas de scope, on invalide toutes les entrées taguées avec ce modèle en particulier.
        if (empty($scopes)) {
            debug('Invalidate all cache entries of the #%s model.', $this->id);
            return $cache->invalidateTags([$entityCacheKey]);
        }

        $cacheKeys = array_map(
            static fn ($scope) => sprintf('%s.%s', $entityCacheKey, $scope),
            is_array($scopes) ? $scopes : [$scopes],
        );
        debug('Invalidate `%s` model cache entry(s).', implode('`,`', $cacheKeys));

        $success = true;
        foreach ($cacheKeys as $cacheKey) {
            if (!$cache->delete($cacheKey)) {
                $success = false;
            }
        }

        return $success;
    }
}
