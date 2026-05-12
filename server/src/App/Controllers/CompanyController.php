<?php
declare(strict_types=1);

namespace Loxya\Controllers;

use Fig\Http\Message\StatusCodeInterface as StatusCode;
use Illuminate\Database\Eloquent\Builder;
use Loxya\Http\Request;
use Loxya\Models\Company;
use Psr\Http\Message\ResponseInterface;
use Slim\Exception\HttpBadRequestException;
use Slim\Http\Response;

final class CompanyController extends BaseController
{
    public function getAll(Request $request, Response $response): ResponseInterface
    {
        $search = $request->getSearchArrayQueryParam('search');
        $limit = $request->getIntegerQueryParam('limit');
        $onlyDeleted = $request->getBooleanQueryParam('deleted', false);
        $orderBy = $request->getOrderByQueryParams('orderBy', 'ascending', Company::class);

        $query = Company::query()
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

    public function getOne(Request $request, Response $response): ResponseInterface
    {
        $id = $request->getIntegerAttribute('id');
        $company = Company::findOrFail($id);

        return $response->withJson($company, StatusCode::STATUS_OK);
    }

    public function create(Request $request, Response $response): ResponseInterface
    {
        $postData = (array) $request->getParsedBody();
        if (empty($postData)) {
            throw new HttpBadRequestException($request, "No data was provided.");
        }

        $company = Company::new($postData);

        return $response->withJson($company, StatusCode::STATUS_CREATED);
    }

    public function update(Request $request, Response $response): ResponseInterface
    {
        $id = $request->getIntegerAttribute('id');
        $company = Company::findOrFail($id);

        $postData = (array) $request->getParsedBody();
        if (empty($postData)) {
            throw new HttpBadRequestException($request, "No data was provided.");
        }

        $company->edit($postData);

        return $response->withJson($company, StatusCode::STATUS_OK);
    }

    public function delete(Request $request, Response $response): ResponseInterface
    {
        $id = $request->getIntegerAttribute('id');
        $company = Company::withTrashed()->findOrFail($id);

        $isDeleted = $company->trashed()
            ? $company->forceDelete()
            : $company->delete();

        if (!$isDeleted) {
            throw new \RuntimeException("An unknown error occurred while deleting the company.");
        }

        return $response->withStatus(StatusCode::STATUS_NO_CONTENT);
    }

    public function restore(Request $request, Response $response): ResponseInterface
    {
        $id = $request->getIntegerAttribute('id');
        $company = Company::query()
            ->onlyTrashed()
            ->findOrFail($id);

        if (!$company->restore()) {
            throw new \RuntimeException(sprintf("Unable to restore the company %d.", $id));
        }

        return $response->withJson($company, StatusCode::STATUS_OK);
    }
}
