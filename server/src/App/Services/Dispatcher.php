<?php
declare(strict_types=1);

namespace Loxya\Services;

use DI\Container;
use Illuminate\Events\Dispatcher as CoreDispatcher;

final class Dispatcher extends CoreDispatcher
{
    private Container $rootContainer;

    public function __construct(Container $container)
    {
        $this->rootContainer = $container;

        parent::__construct();
    }

    protected function createClassCallable($listener)
    {
        [$class, $method] = (
            !is_array($listener)
                ? $this->parseClassCallable($listener)
                : $listener
        );

        if (!method_exists($class, $method)) {
            $method = '__invoke';
        }

        if ($this->handlerShouldBeQueued($class)) {
            return $this->createQueuedHandlerCallable($class, $method);
        }

        $listener = $this->rootContainer->make($class);
        return $this->handlerShouldBeDispatchedAfterDatabaseTransactions($listener)
            ? $this->createCallbackForListenerRunningAfterCommits($listener, $method)
            : [$listener, $method];
    }

    protected function resolveSubscriber($subscriber)
    {
        if (is_string($subscriber)) {
            return $this->rootContainer->make($subscriber);
        }
        return $subscriber;
    }

    protected function handlerWantsToBeQueued($class, $arguments)
    {
        $instance = $this->rootContainer->make($class);
        if (method_exists($instance, 'shouldQueue')) {
            return $instance->shouldQueue($arguments[0]);
        }
        return true;
    }
}
