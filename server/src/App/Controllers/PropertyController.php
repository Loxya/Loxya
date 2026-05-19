<?php
declare(strict_types=1);

namespace Loxya\Controllers;

use Fig\Http\Message\StatusCodeInterface as StatusCode;
use Illuminate\Database\Eloquent\Builder;
use Loxya\Http\Request;
use Loxya\Models\Enums\PropertyEntity;
use Loxya\Models\Property;
use Loxya\Support\Validation\ValidationsException;
use Psr\Http\Message\ResponseInterface;
use Slim\Exception\HttpBadRequestException;
use Slim\Http\Response;

final class PropertyController extends BaseController
{
    public function getAll(Request $request, Response $response): ResponseInterface
    {
        $categoryId = $request->getQueryParam('category');
        $entity = $request->getEnumQueryParam('entity', PropertyEntity::class);

        $properties = Property::query()
            ->when($categoryId !== null, static fn (Builder $query) => (
                $query
                    ->whereDoesntHave('categories')
                    ->when($categoryId !== 'none', static fn (Builder $subQuery) => (
                        $subQuery->orWhereRelation('categories', 'categories.id', $categoryId)
                    ))
            ))
            ->when($entity !== null, static fn (Builder $query) => (
                $query->forEntity($entity)
            ))
            ->with(['categories'])
            ->orderBy('name', 'asc')
            ->get();

        $data = $properties->map(static fn ($property) => static::_formatOne($property));
        return $response->withJson($data, StatusCode::STATUS_OK);
    }

    public function getOne(Request $request, Response $response): ResponseInterface
    {
        $id = $request->getIntegerAttribute('id');
        $property = Property::findOrFail($id);

        $data = static::_formatOne($property);
        return $response->withJson($data, StatusCode::STATUS_OK);
    }

    public function create(Request $request, Response $response): ResponseInterface
    {
        $postData = (array) $request->getParsedBody();
        if (empty($postData)) {
            throw new HttpBadRequestException($request, "No data was provided.");
        }

        try {
            $property = Property::new($postData);
        } catch (ValidationsException $e) {
            $errors = Property::serializeValidation($e->getValidationErrors());
            throw new ValidationsException($errors);
        }

        $data = static::_formatOne($property);
        return $response->withJson($data, StatusCode::STATUS_CREATED);
    }

    public function update(Request $request, Response $response): ResponseInterface
    {
        $id = $request->getIntegerAttribute('id');
        $property = Property::findOrFail($id);

        $postData = (array) $request->getParsedBody();
        if (empty($postData)) {
            throw new HttpBadRequestException($request, "No data was provided.");
        }

        try {
            $property->edit($postData);
        } catch (ValidationsException $e) {
            $errors = Property::serializeValidation($e->getValidationErrors());
            throw new ValidationsException($errors);
        }

        $data = static::_formatOne($property);
        return $response->withJson($data, StatusCode::STATUS_OK);
    }

    public function delete(Request $request, Response $response): ResponseInterface
    {
        $id = $request->getIntegerAttribute('id');
        $property = Property::findOrFail($id);

        if (!$property->delete()) {
            throw new \RuntimeException("An unknown error occurred while deleting the property.");
        }

        return $response->withStatus(StatusCode::STATUS_NO_CONTENT);
    }

    // ------------------------------------------------------
    // -
    // -    Méthodes internes
    // -
    // ------------------------------------------------------

    protected static function _formatOne(Property $property): array
    {
        return $property->serialize(Property::SERIALIZE_DETAILS);
    }
}
