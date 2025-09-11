<?php
declare(strict_types=1);

namespace Loxya\Controllers;

use DI\Container;
use Loxya\Config\Config;
use Loxya\Errors\Exception\HttpRangeNotSatisfiableException;
use Loxya\Http\Request;
use Loxya\Support\Paginator\LengthAwarePaginator;

abstract class BaseController
{
    protected Container $container;

    public function __construct(Container $container)
    {
        $this->container = $container;
    }

    protected function paginate(Request $request, $query, ?int $limit = null): array
    {
        $maxItemsPerPage = Config::get('maxItemsPerPage', 100);
        $limit = min($limit ? (int) $limit : $maxItemsPerPage, $maxItemsPerPage);

        /** @var LengthAwarePaginator $result */
        $result = $query
            ->paginate($limit)
            ->withPath($request->getUri()->getPath())
            ->appends($request->getQueryParams());

        if ($result->currentPage() > $result->lastPage()) {
            throw new HttpRangeNotSatisfiableException(
                $request,
                "Current page number cannot be greater than total pages.",
            );
        }

        return [
            'pagination' => [
                'perPage' => $result->perPage(),
                'currentPage' => $result->currentPage(),
                'total' => [
                    'items' => $result->total(),
                    'pages' => $result->lastPage(),
                ],
            ],
            'data' => $result->getCollection(),
        ];
    }
}
