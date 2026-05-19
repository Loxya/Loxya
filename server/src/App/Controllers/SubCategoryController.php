<?php
declare(strict_types=1);

namespace Loxya\Controllers;

use Fig\Http\Message\StatusCodeInterface as StatusCode;
use Loxya\Http\Request;
use Loxya\Models\SubCategory;
use Psr\Http\Message\ResponseInterface;
use Slim\Exception\HttpBadRequestException;
use Slim\Http\Response;

final class SubCategoryController extends BaseController
{
    public function create(Request $request, Response $response): ResponseInterface
    {
        $postData = (array) $request->getParsedBody();
        if (empty($postData)) {
            throw new HttpBadRequestException($request, "No data was provided.");
        }

        $subCategory = SubCategory::new($postData);

        return $response->withJson($subCategory, StatusCode::STATUS_CREATED);
    }

    public function update(Request $request, Response $response): ResponseInterface
    {
        $id = $request->getIntegerAttribute('id');
        $subCategory = SubCategory::findOrFail($id);

        $postData = (array) $request->getParsedBody();
        if (empty($postData)) {
            throw new HttpBadRequestException($request, "No data was provided.");
        }

        $subCategory->edit($postData);

        return $response->withJson($subCategory, StatusCode::STATUS_OK);
    }

    public function delete(Request $request, Response $response): ResponseInterface
    {
        $id = $request->getIntegerAttribute('id');
        $subCategory = SubCategory::findOrFail($id);

        if (!$subCategory->delete()) {
            throw new \RuntimeException("An unknown error occurred while deleting the sub-category.");
        }

        return $response->withStatus(StatusCode::STATUS_NO_CONTENT);
    }
}
