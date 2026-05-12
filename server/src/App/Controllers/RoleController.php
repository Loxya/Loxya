<?php
declare(strict_types=1);

namespace Loxya\Controllers;

use Fig\Http\Message\StatusCodeInterface as StatusCode;
use Illuminate\Database\Eloquent\Builder;
use Loxya\Config\Enums\Feature;
use Loxya\Errors\Exception\HttpConflictException;
use Loxya\Http\Request;
use Loxya\Models\Role;
use Psr\Http\Message\ResponseInterface;
use Slim\Exception\HttpBadRequestException;
use Slim\Exception\HttpNotFoundException;
use Slim\Http\Response;

final class RoleController extends BaseController
{
    public function getAll(Request $request, Response $response): ResponseInterface
    {
        if (!isFeatureEnabled(Feature::TECHNICIANS)) {
            throw new HttpNotFoundException($request, "Technician feature is disabled.");
        }

        $search = $request->getSearchArrayQueryParam('search');

        $roles = Role::query()
            ->when(
                !empty($search),
                static fn (Builder $subQuery) => $subQuery->search($search),
            )
            ->orderBy('name', 'asc')
            ->get();

        return $response->withJson($roles, StatusCode::STATUS_OK);
    }

    public function create(Request $request, Response $response): ResponseInterface
    {
        if (!isFeatureEnabled(Feature::TECHNICIANS)) {
            throw new HttpNotFoundException($request, "Technician feature is disabled.");
        }

        $postData = (array) $request->getParsedBody();
        if (empty($postData)) {
            throw new HttpBadRequestException($request, "No data was provided.");
        }

        $role = Role::new($postData);

        return $response->withJson($role, StatusCode::STATUS_CREATED);
    }

    public function update(Request $request, Response $response): ResponseInterface
    {
        if (!isFeatureEnabled(Feature::TECHNICIANS)) {
            throw new HttpNotFoundException($request, "Technician feature is disabled.");
        }

        $id = $request->getIntegerAttribute('id');
        $role = Role::findOrFail($id);

        $postData = (array) $request->getParsedBody();
        if (empty($postData)) {
            throw new HttpBadRequestException($request, "No data was provided.");
        }

        $role->edit($postData);

        return $response->withJson($role, StatusCode::STATUS_OK);
    }

    public function delete(Request $request, Response $response): ResponseInterface
    {
        if (!isFeatureEnabled(Feature::TECHNICIANS)) {
            throw new HttpNotFoundException($request, "Technician feature is disabled.");
        }

        $id = $request->getIntegerAttribute('id');

        $role = Role::findOrFail($id);
        if ($role->is_used) {
            throw new HttpConflictException($request, "This role cannot be deleted because it is in use.");
        }

        if (!$role->delete()) {
            throw new \RuntimeException("An unknown error occurred while deleting the role.");
        }

        return $response->withStatus(StatusCode::STATUS_NO_CONTENT);
    }
}
