<?php
declare(strict_types=1);

namespace Loxya\Controllers;

use Fig\Http\Message\StatusCodeInterface as StatusCode;
use Illuminate\Database\Eloquent\Builder;
use Loxya\Http\Request;
use Loxya\Models\Person;
use Psr\Http\Message\ResponseInterface;
use Slim\Http\Response;

final class PersonController extends BaseController
{
    public function getAll(Request $request, Response $response): ResponseInterface
    {
        $search = $request->getSearchArrayQueryParam('search');
        $limit = $request->getIntegerQueryParam('limit');
        $onlyDeleted = $request->getBooleanQueryParam('deleted', false);
        $orderBy = $request->getOrderByQueryParams('orderBy', 'ascending', Person::class);

        $query = Person::query()
            ->when(!empty($search), static fn (Builder $subQuery) => (
                $subQuery->search($search)
            ))
            ->when($onlyDeleted, static fn (Builder $subQuery) => (
                $subQuery->onlyTrashed()
            ))
            ->when($orderBy !== null, static fn (Builder $subQuery) => (
                $subQuery->customOrderBy($orderBy['column'], $orderBy['direction'])
            ));

        $results = $this->paginate($request, $query, $limit);
        return $response->withJson($results, StatusCode::STATUS_OK);
    }
}
