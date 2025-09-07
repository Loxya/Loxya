<?php
declare(strict_types=1);

namespace Loxya\Controllers\Traits\Crud;

use Fig\Http\Message\StatusCodeInterface as StatusCode;
use Illuminate\Database\Eloquent\Builder;
use Loxya\Controllers\Traits\WithModel;
use Loxya\Http\Request;
use Psr\Http\Message\ResponseInterface;
use Slim\Http\Response;

trait GetAll
{
    use WithModel;

    public function getAll(Request $request, Response $response): ResponseInterface
    {
        $search = $request->getSearchArrayQueryParam('search');
        $limit = $request->getIntegerQueryParam('limit');
        $ascending = $request->getBooleanQueryParam('ascending', true);
        $onlyDeleted = $request->getBooleanQueryParam('deleted', false);
        $orderBy = $request->getOrderByQueryParam('orderBy', $this->getModelClass());

        // @phpstan-ignore-next-line
        $query = $this->getModelClass()::query()
            ->when(
                !empty($search),
                static fn (Builder $subQuery) => $subQuery->search($search),
            )
            ->when($onlyDeleted, static fn (Builder $subQuery) => (
                $subQuery->onlyTrashed()
            ))
            ->when($orderBy !== null, static fn (Builder $subQuery) => (
                $subQuery->customOrderBy($orderBy, $ascending ? 'asc' : 'desc')
            ));

        $results = $this->paginate($request, $query, $limit);
        return $response->withJson($results, StatusCode::STATUS_OK);
    }

    // ------------------------------------------------------
    // -
    // -    Méthodes abstraites
    // -
    // ------------------------------------------------------

    abstract protected function paginate(Request $request, $query, ?int $limit = null): array;
}
