<?php
declare(strict_types=1);

namespace Loxya\Services;

use Loxya\Config\Config;
use phpmock\environment\MockEnvironment;
use phpmock\MockBuilder as TimeFunctionMockBuilder;
use Symfony\Component\Cache\Adapter\FilesystemAdapter;
use Symfony\Component\Cache\Adapter\TagAwareAdapter;

final class Cache extends TagAwareAdapter
{
    private static ?MockEnvironment $testNowMock = null;

    public function __construct()
    {
        // - Dans les environnements de test, on défini l'environnement mockés
        //   avant toute chose sans quoi il ne sera plus possible de le faire après.
        if (Config::getEnv() === 'test') {
            static::getMockEnvironment()->define();
        }

        $storage = new FilesystemAdapter('core', 0, CACHE_FOLDER);
        parent::__construct(new TagAwareAdapter($storage));
    }

    /**
     * Définit une date fixe à utiliser pour les tests pour la génération des entrées de cache.
     *
     * @param \DateTimeInterface|null $testNow La date de test à fixer, ou `null` pour la réinitialiser.
     */
    public static function setTestNow(\DateTimeInterface|null $testNow = null)
    {
        // - S'il y a déjà un mock en place, on le désactive avant de faire quoi que ce soit.
        if (static::$testNowMock !== null) {
            static::$testNowMock->disable();
            static::$testNowMock = null;
        }

        if ($testNow === null) {
            return;
        }

        static::$testNowMock = static::getMockEnvironment($testNow);
        static::$testNowMock->enable();
    }

    /**
     * Indique si une date de test a été définie pour la génération des entrées de cache.
     *
     * @return bool `true` si une date de test a été définie, `false` sinon.
     */
    public static function hasTestNow(): bool
    {
        return static::$testNowMock !== null;
    }

    private static function getMockEnvironment(\DateTimeInterface|null $testNow = null): MockEnvironment
    {
        $namespaces = [
            'Symfony\\Component\\Cache',
            'Symfony\\Component\\Cache\\Adapter',
            'Symfony\\Component\\Cache\\Messenger',
            'Symfony\\Component\\Cache\\DataCollector',
            'Symfony\\Component\\Cache\\Traits',
        ];

        $mocks = [];
        foreach ($namespaces as $namespace) {
            $mocks[] = (new TimeFunctionMockBuilder())
                ->setNamespace($namespace)
                ->setName('time')
                ->setFunction(static function () use ($testNow) {
                    if ($testNow === null) {
                        throw new \RuntimeException("Test \"now\" should have been defined.");
                    }
                    return $testNow->getTimestamp();
                })
                ->build();

            $mocks[] = (new TimeFunctionMockBuilder())
                ->setNamespace($namespace)
                ->setName('microtime')
                ->setFunction(static function (bool $asFloat = false) use ($testNow) {
                    if ($testNow === null) {
                        throw new \RuntimeException("Test \"now\" should have been defined.");
                    }

                    $value = $testNow->format('U.u');
                    return $asFloat ? (float) $value : $value;
                })
                ->build();
        }

        return new MockEnvironment($mocks);
    }
}
