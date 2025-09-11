<?php
declare(strict_types=1);

namespace Loxya\Controllers;

use Fig\Http\Message\StatusCodeInterface as StatusCode;
use Illuminate\Database\Eloquent\Builder;
use Loxya\Controllers\Traits\Crud;
use Loxya\Http\Request;
use Loxya\Models\Enums\PropertyEntity;
use Loxya\Models\Property;
use Psr\Http\Message\ResponseInterface;
use Slim\Http\Response;

final class PropertyController extends BaseController
{
    use Crud\GetOne;
    use Crud\Create;
    use Crud\Update;
    use Crud\HardDelete;

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
