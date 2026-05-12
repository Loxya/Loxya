<?php
declare(strict_types=1);

namespace Loxya\Controllers;

use Fig\Http\Message\StatusCodeInterface as StatusCode;
use Illuminate\Database\Eloquent\Builder;
use Loxya\Http\Request;
use Loxya\Models\Material;
use Loxya\Models\Park;
use Psr\Http\Message\ResponseInterface;
use Slim\Exception\HttpBadRequestException;
use Slim\Exception\HttpNotFoundException;
use Slim\Http\Response;

final class ParkController extends BaseController
{
    public function getAll(Request $request, Response $response): ResponseInterface
    {
        $search = $request->getSearchArrayQueryParam('search');
        $limit = $request->getIntegerQueryParam('limit');
        $onlyDeleted = $request->getBooleanQueryParam('deleted', false);
        $orderBy = $request->getOrderByQueryParams('orderBy', 'ascending', Park::class);

        $query = Park::query()
            ->when(
                !empty($search),
                static fn (Builder $subQuery) => $subQuery->search($search),
            )
            ->when($onlyDeleted, static fn (Builder $subQuery) => (
                $subQuery->onlyTrashed()
            ))
            ->when($orderBy !== null, static fn (Builder $subQuery) => (
                $subQuery->customOrderBy($orderBy['column'], $orderBy['direction'])
            ));

        $results = $this->paginate($request, $query, $limit);
        return $response->withJson($results, StatusCode::STATUS_OK);
    }

    public function getList(Request $request, Response $response): ResponseInterface
    {
        $parks = Park::query()
            ->orderBy('name')
            ->get();

        $data = $parks->map(static fn ($park) => $park->serialize(Park::SERIALIZE_SUMMARY));
        return $response->withJson($data, StatusCode::STATUS_OK);
    }

    public function getOne(Request $request, Response $response): ResponseInterface
    {
        $id = $request->getIntegerAttribute('id');

        $park = Park::findOrFail($id);

        $data = static::_formatOne($park);
        return $response->withJson($data, StatusCode::STATUS_OK);
    }

    public function getOneMaterials(Request $request, Response $response): ResponseInterface
    {
        $id = $request->getIntegerAttribute('id');

        if (!Park::includes($id)) {
            throw new HttpNotFoundException($request);
        }

        $materials = Material::getParkAll($id);
        return $response->withJson($materials, StatusCode::STATUS_OK);
    }

    public function getOneTotalAmount(Request $request, Response $response): ResponseInterface
    {
        $id = $request->getIntegerAttribute('id');

        /** @var Park $park */
        $park = Park::findOrFail($id);

        return $response->withJson($park->total_amount, StatusCode::STATUS_OK);
    }

    public function create(Request $request, Response $response): ResponseInterface
    {
        $postData = (array) $request->getParsedBody();
        if (empty($postData)) {
            throw new HttpBadRequestException($request, "No data was provided.");
        }

        $park = Park::new($postData);

        $data = static::_formatOne($park);
        return $response->withJson($data, StatusCode::STATUS_CREATED);
    }

    public function update(Request $request, Response $response): ResponseInterface
    {
        $id = $request->getIntegerAttribute('id');

        $park = Park::findOrFail($id);

        $postData = (array) $request->getParsedBody();
        if (empty($postData)) {
            throw new HttpBadRequestException($request, "No data was provided.");
        }

        $park->edit($postData);

        $data = static::_formatOne($park);
        return $response->withJson($data, StatusCode::STATUS_OK);
    }

    public function delete(Request $request, Response $response): ResponseInterface
    {
        $id = $request->getIntegerAttribute('id');

        $park = Park::withTrashed()->findOrFail($id);

        $isDeleted = $park->trashed()
            ? $park->forceDelete()
            : $park->delete();

        if (!$isDeleted) {
            throw new \RuntimeException("An unknown error occurred while deleting the park.");
        }

        return $response->withStatus(StatusCode::STATUS_NO_CONTENT);
    }

    public function restore(Request $request, Response $response): ResponseInterface
    {
        $id = $request->getIntegerAttribute('id');

        $park = Park::query()
            ->onlyTrashed()
            ->findOrFail($id);

        if (!$park->restore()) {
            throw new \RuntimeException(sprintf("Unable to restore the park %d.", $id));
        }

        $data = static::_formatOne($park);
        return $response->withJson($data, StatusCode::STATUS_OK);
    }

    // ------------------------------------------------------
    // -
    // -    Méthodes internes
    // -
    // ------------------------------------------------------

    protected static function _formatOne(Park $park): array
    {
        return $park->serialize(Park::SERIALIZE_DETAILS);
    }
}
