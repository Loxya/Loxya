<?php
declare(strict_types=1);

namespace Loxya\Controllers;

use Fig\Http\Message\StatusCodeInterface as StatusCode;
use Illuminate\Database\Eloquent\Builder;
use Loxya\Http\Request;
use Loxya\Models\Tag;
use Psr\Http\Message\ResponseInterface;
use Slim\Exception\HttpBadRequestException;
use Slim\Http\Response;

final class TagController extends BaseController
{
    public function getAll(Request $request, Response $response): ResponseInterface
    {
        $onlyDeleted = $request->getBooleanQueryParam('deleted', false);

        $tags = Tag::query()
            ->when($onlyDeleted, static fn (Builder $subQuery) => (
                $subQuery->onlyTrashed()
            ))
            ->orderBy('name')
            ->get();

        return $response->withJson($tags, StatusCode::STATUS_OK);
    }

    public function getOne(Request $request, Response $response): ResponseInterface
    {
        $id = $request->getIntegerAttribute('id');
        $tag = Tag::findOrFail($id);

        return $response->withJson($tag, StatusCode::STATUS_OK);
    }

    public function create(Request $request, Response $response): ResponseInterface
    {
        $postData = (array) $request->getParsedBody();
        if (empty($postData)) {
            throw new HttpBadRequestException($request, "No data was provided.");
        }

        $tag = Tag::new($postData);

        return $response->withJson($tag, StatusCode::STATUS_CREATED);
    }

    public function update(Request $request, Response $response): ResponseInterface
    {
        $id = $request->getIntegerAttribute('id');
        $tag = Tag::findOrFail($id);

        $postData = (array) $request->getParsedBody();
        if (empty($postData)) {
            throw new HttpBadRequestException($request, "No data was provided.");
        }

        $tag->edit($postData);

        return $response->withJson($tag, StatusCode::STATUS_OK);
    }

    public function delete(Request $request, Response $response): ResponseInterface
    {
        $id = $request->getIntegerAttribute('id');
        $tag = Tag::withTrashed()->findOrFail($id);

        $isDeleted = $tag->trashed()
            ? $tag->forceDelete()
            : $tag->delete();

        if (!$isDeleted) {
            throw new \RuntimeException("An unknown error occurred while deleting the tag.");
        }

        return $response->withStatus(StatusCode::STATUS_NO_CONTENT);
    }

    public function restore(Request $request, Response $response): ResponseInterface
    {
        $id = $request->getIntegerAttribute('id');

        $tag = Tag::query()
            ->onlyTrashed()
            ->findOrFail($id);

        if (!$tag->restore()) {
            throw new \RuntimeException(sprintf("Unable to restore the tag %d.", $id));
        }

        return $response->withJson($tag, StatusCode::STATUS_OK);
    }
}
