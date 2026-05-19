<?php
declare(strict_types=1);

namespace Loxya\Controllers;

use Fig\Http\Message\StatusCodeInterface as StatusCode;
use Illuminate\Database\Eloquent\Builder;
use Loxya\Http\Request;
use Loxya\Models\Enums\Group;
use Loxya\Models\User;
use Loxya\Services\Auth;
use Loxya\Support\Arr;
use Loxya\Support\Validation\ValidationsException;
use Psr\Http\Message\ResponseInterface;
use Slim\Exception\HttpBadRequestException;
use Slim\Exception\HttpForbiddenException;
use Slim\Http\Response;

final class UserController extends BaseController
{
    public function getAll(Request $request, Response $response): ResponseInterface
    {
        $search = $request->getSearchArrayQueryParam('search');
        $group = $request->getRawEnumQueryParam('group', Group::all());
        $limit = $request->getIntegerQueryParam('limit');
        $onlyDeleted = $request->getBooleanQueryParam('deleted', false);
        $orderBy = $request->getOrderByQueryParams('orderBy', 'ascending', User::class);

        $query = User::query()
            ->when(!empty($search), static fn (Builder $subQuery) => (
                $subQuery->search($search)
            ))
            ->when($group !== null, static fn (Builder $subQuery) => (
                $subQuery->where('group', '=', $group)
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
        $id = $request->getAttribute('id');
        if ($id !== 'self') {
            $user = User::findOrFail($id);
            if (Auth::user()->is($user)) {
                throw new HttpForbiddenException(
                    $request,
                    'Self retrieving this way is forbidden, use `GET /api/users/self`.',
                );
            }

            // - Si ce n'est pas un admin, on empêche la récupération des autres utilisateurs.
            if (!Auth::is(Group::ADMINISTRATION)) {
                throw new HttpForbiddenException($request);
            }
        } else {
            $user = clone Auth::user();
        }

        $data = static::_formatOne($user);
        return $response->withJson($data, StatusCode::STATUS_OK);
    }

    public function create(Request $request, Response $response): ResponseInterface
    {
        $postData = (array) $request->getParsedBody();
        if (empty($postData)) {
            throw new HttpBadRequestException($request, "No data was provided.");
        }
        $postData = User::unserialize($postData);

        try {
            $user = User::new($postData);
        } catch (ValidationsException $e) {
            $errors = $e->getValidationErrors();
            if (empty($errors)) {
                throw $e;
            }

            $errors = User::serializeValidation($errors);
            throw new ValidationsException($errors);
        }

        $data = static::_formatOne($user);
        return $response->withJson($data, StatusCode::STATUS_CREATED);
    }

    public function update(Request $request, Response $response): ResponseInterface
    {
        $postData = (array) $request->getParsedBody();
        if (empty($postData)) {
            throw new HttpBadRequestException($request, "No data was provided.");
        }

        $id = $request->getAttribute('id');
        if ($id !== 'self') {
            $user = User::findOrFail($id);
            if (Auth::user()->is($user)) {
                throw new HttpForbiddenException(
                    $request,
                    'Self update this way is forbidden, use `PUT /api/users/self`.',
                );
            }

            // - Si ce n'est pas un admin, on empêche la modification des autres utilisateurs.
            if (!Auth::is(Group::ADMINISTRATION)) {
                throw new HttpForbiddenException($request);
            }

            $postData = User::unserialize($postData);
            try {
                $user->edit($postData);
            } catch (ValidationsException $e) {
                $errors = User::serializeValidation($e->getValidationErrors());
                throw new ValidationsException($errors);
            }

            $data = static::_formatOne($user);
            return $response->withJson($data, StatusCode::STATUS_OK);
        }
        $user = clone Auth::user();

        $postData = User::unserialize(
            Arr::except($postData, array_merge(User::SETTINGS_ATTRIBUTES, [
                'id',
                'group',
            ])),
        );

        try {
            $user->edit($postData);
            Auth::user()->refresh();
        } catch (ValidationsException $e) {
            $errors = User::serializeValidation($e->getValidationErrors());
            throw new ValidationsException($errors);
        }

        $data = static::_formatOne($user);
        return $response->withJson($data, StatusCode::STATUS_OK);
    }

    public function getSettings(Request $request, Response $response): ResponseInterface
    {
        $id = $request->getAttribute('id');
        if ($id !== 'self') {
            $user = User::findOrFail($id);
            if (Auth::user()->is($user)) {
                throw new HttpForbiddenException(
                    $request,
                    'Self retrieving this way is forbidden, use `GET /api/users/self`.',
                );
            }

            // - Si ce n'est pas un admin, on empêche la récupération des autres utilisateurs.
            if (!Auth::is(Group::ADMINISTRATION)) {
                throw new HttpForbiddenException($request);
            }
        } else {
            $user = clone Auth::user();
        }

        $data = $user->serialize(User::SERIALIZE_SETTINGS);
        return $response->withJson($data, StatusCode::STATUS_OK);
    }

    public function updateSettings(Request $request, Response $response): ResponseInterface
    {
        $id = $request->getAttribute('id');
        if ($id !== 'self') {
            $user = User::findOrFail($id);
            if (Auth::user()->is($user)) {
                throw new HttpForbiddenException(
                    $request,
                    'Self updating this way is forbidden, use `PUT /api/users/self/settings`.',
                );
            }

            // - Si ce n'est pas un admin, on empêche la récupération des autres utilisateurs.
            if (!Auth::is(Group::ADMINISTRATION)) {
                throw new HttpForbiddenException($request);
            }
        } else {
            $user = clone Auth::user();
        }

        $postData = Arr::only(
            (array) $request->getParsedBody(),
            User::SETTINGS_ATTRIBUTES,
        );
        if (empty($postData)) {
            throw new HttpBadRequestException($request, 'No data was provided.');
        }

        try {
            $user->edit($postData);

            if (Auth::user()->is($user)) {
                Auth::user()->refresh();
            }
        } catch (ValidationsException $e) {
            $errors = $e->getValidationErrors();
            if (empty($errors)) {
                throw $e;
            }

            $errors = User::serializeValidation($errors);
            throw new ValidationsException($errors);
        }

        $data = $user->serialize(User::SERIALIZE_SETTINGS);
        return $response->withJson($data, StatusCode::STATUS_OK);
    }

    public function delete(Request $request, Response $response): ResponseInterface
    {
        $id = $request->getIntegerAttribute('id');
        if (Auth::user()->id === $id) {
            throw new HttpForbiddenException($request, 'Self deletion is forbidden.');
        }

        $user = User::withTrashed()->findOrFail($id);

        $isDeleted = $user->trashed()
            ? $user->forceDelete()
            : $user->delete();

        if (!$isDeleted) {
            throw new \RuntimeException("An unknown error occurred while deleting the user.");
        }

        return $response->withStatus(StatusCode::STATUS_NO_CONTENT);
    }

    public function restore(Request $request, Response $response): ResponseInterface
    {
        $id = $request->getIntegerAttribute('id');

        $user = User::query()
            ->onlyTrashed()
            ->findOrFail($id);

        if (!$user->restore()) {
            throw new \RuntimeException(sprintf("Unable to restore the user %d.", $id));
        }

        $data = static::_formatOne($user);
        return $response->withJson($data, StatusCode::STATUS_OK);
    }

    // ------------------------------------------------------
    // -
    // -    Méthodes internes
    // -
    // ------------------------------------------------------

    protected static function _formatOne(User $user): array
    {
        return $user->serialize(User::SERIALIZE_DETAILS);
    }
}
