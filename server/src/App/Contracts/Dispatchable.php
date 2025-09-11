<?php
declare(strict_types=1);

namespace Loxya\Contracts;

use Loxya\Services\Dispatcher;

abstract class Dispatchable
{
    /**
     * Dispatch the event with the given arguments.
     *
     * @return array|null
     */
    public static function dispatch(...$args)
    {
        /** @var Dispatcher $dispatcher */
        $dispatcher = container('events');

        // @phpstan-ignore-next-line new.static
        return $dispatcher->dispatch(new static(...$args));
    }
}
