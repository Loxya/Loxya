<?php
declare(strict_types=1);

namespace Loxya\Controllers;

use Fig\Http\Message\StatusCodeInterface as StatusCode;
use Loxya\Http\Request;
use Loxya\Models\Category;
use Psr\Http\Message\ResponseInterface;
use Slim\Exception\HttpBadRequestException;
use Slim\Http\Response;

final class CategoryController extends BaseController
{
    public function getAll(Request $request, Response $response): ResponseInterface
    {
        $categories = Category::orderBy('name', 'asc')
            ->with(['subCategories'])
            ->get();

        $categories = $categories->map(static fn ($category) => static::_formatOne($category));
        return $response->withJson($categories, StatusCode::STATUS_OK);
    }

    public function create(Request $request, Response $response): ResponseInterface
    {
        $postData = (array) $request->getParsedBody();
        if (empty($postData)) {
            throw new HttpBadRequestException($request, "No data was provided.");
        }

        $category = Category::new($postData);

        $data = static::_formatOne($category);
        return $response->withJson($data, StatusCode::STATUS_CREATED);
    }

    public function update(Request $request, Response $response): ResponseInterface
    {
        $id = $request->getIntegerAttribute('id');
        $category = Category::findOrFail($id);

        $postData = (array) $request->getParsedBody();
        if (empty($postData)) {
            throw new HttpBadRequestException($request, "No data was provided.");
        }

        $category->edit($postData);

        $data = static::_formatOne($category);
        return $response->withJson($data, StatusCode::STATUS_OK);
    }

    public function delete(Request $request, Response $response): ResponseInterface
    {
        $id = $request->getIntegerAttribute('id');
        $category = Category::findOrFail($id);

        if (!$category->delete()) {
            throw new \RuntimeException("An unknown error occurred while deleting the category.");
        }

        return $response->withStatus(StatusCode::STATUS_NO_CONTENT);
    }

    // ------------------------------------------------------
    // -
    // -    Méthodes internes
    // -
    // ------------------------------------------------------

    protected static function _formatOne(Category $category): array
    {
        return $category->serialize(Category::SERIALIZE_DETAILS);
    }
}
