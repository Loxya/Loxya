<?php
declare(strict_types=1);

namespace Loxya;

use DI\Container;
use DI\ContainerBuilder;
use Illuminate\Container\Container as IlluminateContainer;
use Illuminate\Database\Capsule\Manager as Database;
use Illuminate\Database\DatabaseTransactionsManager;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Support\LazyCollection;
use Illuminate\Support\Reflector;
use Loxya\Config\Config;
use Loxya\Services\Cache;
use Loxya\Services\Dispatcher;
use Loxya\Support\Paginator\CursorPaginator;
use Loxya\Support\Paginator\LengthAwarePaginator;
use Loxya\Support\Paginator\Paginator;
use Loxya\Support\Str;
use Respect\Validation\Factory as ValidatorFactory;
use Symfony\Component\Finder\Finder;
use Symfony\Contracts\Cache\ItemInterface as CacheItemInterface;

final class Kernel
{
    private static $instance;

    protected Container $container;

    public static function boot(): static
    {
        if (!is_null(static::$instance)) {
            return static::$instance;
        }
        return static::$instance = new static();
    }

    public static function get(): static
    {
        if (is_null(static::$instance)) {
            throw new \LogicException("Attempt to retrieve the kernel before it boots.");
        }
        return static::$instance;
    }

    public static function reset(): void
    {
        IlluminateContainer::getInstance()->flush();

        static::$instance = new static();
    }

    // ------------------------------------------------------
    // -
    // -    Instance methods
    // -
    // ------------------------------------------------------

    private function __construct()
    {
        $this->initializeContainer();
        $this->initializeValidator();
        $this->initializeDatabase();
        $this->initializeEvents();
    }

    public function getContainer(): Container
    {
        if (!$this->container) {
            throw new \LogicException("Unable to retrieve the container from an uninitialized kernel.");
        }
        return $this->container;
    }

    // ------------------------------------------------------
    // -
    // -    Internal Methods
    // -
    // ------------------------------------------------------

    protected function initializeContainer(): void
    {
        $this->container = (new ContainerBuilder())
            ->addDefinitions(CONFIG_FOLDER . DS . 'definitions.php')
            ->build();
    }

    protected function initializeValidator(): void
    {
        ValidatorFactory::setDefaultInstance(
            (new ValidatorFactory())
                ->withRuleNamespace('Loxya\\Support\\Validation\\Rules')
                ->withExceptionNamespace('Loxya\\Support\\Validation\\Exceptions')
                ->withTranslator(fn ($value) => (
                    $this->container->get('i18n')->translate($value)
                )),
        );
    }

    protected function initializeEvents(): void
    {
        /** @var Cache $cache */
        $cache = $this->container->get('cache');

        /** @var array<string, string[]> $events */
        $events = $cache->get('core.events', static function (CacheItemInterface $cacheItem) {
            $cacheItem->expiresAfter(
                Config::getEnv() === 'production'
                    ? new \DateInterval('P1D')
                    : 0,
            );

            return (new LazyCollection(glob(LISTENERS_FOLDER, GLOB_ONLYDIR)))
                ->reject(static fn ($directory) => !is_dir($directory))
                ->pipe(static function (LazyCollection $directories) {
                    $listenerFiles = Finder::create()
                        ->in($directories->all())
                        ->files();

                    $discoveredEvents = [];
                    foreach ($listenerFiles as $file) {
                        try {
                            $classFile = trim(Str::replaceFirst(LISTENERS_FOLDER, '', $file->getRealPath()), DS);
                            $classFqn = sprintf('\\Loxya\\Listeners\\%s', ucfirst(Str::camel(
                                str_replace(DS, '\\', Str::replaceLast('.php', '', $classFile)),
                            )));
                            $listener = new \ReflectionClass($classFqn);
                        } catch (\ReflectionException) {
                            continue;
                        }

                        if (!$listener->isInstantiable()) {
                            continue;
                        }

                        foreach ($listener->getMethods(\ReflectionMethod::IS_PUBLIC) as $method) {
                            if (
                                !Str::is('handle*', $method->name) && !Str::is('__invoke', $method->name) ||
                                !isset($method->getParameters()[0])
                            ) {
                                continue;
                            }

                            $listener = sprintf('%s@%s', $listener->name, $method->name);
                            $events = Reflector::getParameterClassNames($method->getParameters()[0]);
                            foreach ($events as $event) {
                                $discoveredEvents[$event] ??= [];
                                $discoveredEvents[$event][] = $listener;
                            }
                        }
                    }
                    return $discoveredEvents;
                });
        });

        foreach ($events as $event => $listeners) {
            foreach (array_unique($listeners, SORT_REGULAR) as $listener) {
                /** @var Dispatcher $dispatcher */
                $dispatcher = $this->container->get('events');
                $dispatcher->listen($event, $listener);
            }
        }
    }

    protected function initializeDatabase(): void
    {
        // - Illuminate container.
        $illuminateContainer = IlluminateContainer::getInstance();
        $illuminateContainer->singleton('db.transactions', static fn () => (
            new DatabaseTransactionsManager()
        ));
        $illuminateContainer->bind(
            \Illuminate\Pagination\LengthAwarePaginator::class,
            LengthAwarePaginator::class,
        );
        $illuminateContainer->bind(
            \Illuminate\Pagination\CursorPaginator::class,
            CursorPaginator::class,
        );
        $illuminateContainer->bind(
            \Illuminate\Pagination\Paginator::class,
            Paginator::class,
        );

        // - Utilise l'event dispatcher de l'application et
        //   configuration sa gestion des transactions.
        /** @var Dispatcher $eventDispatcher */
        $eventDispatcher = $this->container->get('events');
        $eventDispatcher->setTransactionManagerResolver(static fn () => (
            $illuminateContainer->get('db.transactions')
        ));

        // - Database.
        $database = new Database($illuminateContainer);
        $database->addConnection(Config::getDbConfig());
        $database->setEventDispatcher($eventDispatcher);
        $database->bootEloquent();

        $this->container->set('database', $database);

        // - Configuration du fonctionnement des modèles.
        // TODO: Model::preventSilentlyDiscardingAttributes();
        Model::preventAccessingMissingAttributes();

        // - Morphs
        Relation::enforceMorphMap([
            Models\Event::TYPE => Models\Event::class,
            Models\Material::TYPE => Models\Material::class,
            Models\Technician::TYPE => Models\Technician::class,
        ]);

        // - Observers
        Models\Event::observe(Observers\EventObserver::class);
        Models\EventTechnician::observe(Observers\EventTechnicianObserver::class);
        Models\EventPosition::observe(Observers\EventPositionObserver::class);
        Models\EventMaterial::observe(Observers\EventMaterialObserver::class);
        Models\Material::observe(Observers\MaterialObserver::class);
        Models\Property::observe(Observers\PropertyObserver::class);
        Models\PropertyCategory::observe(Observers\PropertyCategoryObserver::class);
        Models\Beneficiary::observe(Observers\BeneficiaryObserver::class);
        Models\Park::observe(Observers\ParkObserver::class);
        Models\Technician::observe(Observers\TechnicianObserver::class);
        Models\User::observe(Observers\UserObserver::class);
    }
}
