<?php
declare(strict_types=1);

namespace Loxya\Tests\Fixtures;

use Illuminate\Database\DatabaseTransactionsManager as BaseManager;

class TransactionsManager extends BaseManager
{
    public function addCallback($callback)
    {
        if ($this->callbackApplicableTransactions()->count() === 0) {
            return $callback();
        }
        $this->pendingTransactions->last()->addCallback($callback);
    }

    public function callbackApplicableTransactions()
    {
        return $this->pendingTransactions->skip(1)->values();
    }

    public function afterCommitCallbacksShouldBeExecuted($level)
    {
        return $level === 1;
    }
}
