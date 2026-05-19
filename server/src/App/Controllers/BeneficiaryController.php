<?php
declare(strict_types=1);

namespace Loxya\Controllers;

use Fig\Http\Message\StatusCodeInterface as StatusCode;
use Illuminate\Database\Eloquent\Builder;
use Loxya\Http\Request;
use Loxya\Models\Beneficiary;
use Loxya\Models\Enums\Group;
use Loxya\Models\Event;
use Loxya\Models\Park;
use Loxya\Services\Auth;
use Loxya\Support\Database\QueryAggregator;
use Loxya\Support\Validation\ValidationsException;
use Psr\Http\Message\ResponseInterface;
use Slim\Exception\HttpBadRequestException;
use Slim\Http\Response;

final class BeneficiaryController extends BaseController
{
    public function getAll(Request $request, Response $response): ResponseInterface
    {
        $search = $request->getSearchArrayQueryParam('search');
        $limit = $request->getIntegerQueryParam('limit');
        $onlyDeleted = $request->getBooleanQueryParam('deleted', false);
        $orderBy = $request->getOrderByQueryParams('orderBy', 'ascending', Beneficiary::class);

        $query = Beneficiary::query()
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
        $beneficiary = Beneficiary::findOrFail($id);

        $data = static::_formatOne($beneficiary);
        return $response->withJson($data, StatusCode::STATUS_OK);
    }

    public function getBookings(Request $request, Response $response): ResponseInterface
    {
        $id = $request->getIntegerAttribute('id');
        $after = $request->getDateQueryParam('after');
        $limit = $request->getIntegerQueryParam('limit', 50);
        $direction = $request->getRawEnumQueryParam(
            'direction',
            ['asc', 'desc'],
            'desc',
        );

        $beneficiary = Beneficiary::findOrFail($id);

        $eventsQuery = $beneficiary->events()
            ->with(['beneficiaries', 'technicians'])
            ->with(['materials' => static function ($q) {
                $q->reorder('name', 'asc');
            }]);

        if ($after !== null) {
            $eventsQuery->closureSameOrAfter($after);
        }

        $query = (new QueryAggregator())
            ->add(Event::class, $eventsQuery)
            ->orderBy('mobilization_start_date', $direction);

        $results = $this->paginate($request, $query, $limit);

        // - Le prefetching a été supprimé car ça ajoutait une trop grosse
        //   utilisation de la mémoire, et ralentissait beaucoup la requête.

        $useMultipleParks = Park::count() > 1;

        $results['data'] = $results['data']->map(static fn ($booking) => array_replace(
            $booking->serialize($booking::SERIALIZE_BOOKING_EXCERPT),
            [
                'parks' => $useMultipleParks
                    ? array_values($booking->parks)
                    : [],
            ],
        ));

        return $response->withJson($results, StatusCode::STATUS_OK);
    }

    public function getEstimates(Request $request, Response $response): ResponseInterface
    {
        $id = $request->getIntegerAttribute('id');
        $beneficiary = Beneficiary::findOrFail($id);
        $estimates = $beneficiary->estimates;

        return $response->withJson($estimates, StatusCode::STATUS_OK);
    }

    public function getInvoices(Request $request, Response $response): ResponseInterface
    {
        $id = $request->getIntegerAttribute('id');
        $beneficiary = Beneficiary::findOrFail($id);
        $invoices = $beneficiary->invoices;

        return $response->withJson($invoices, StatusCode::STATUS_OK);
    }

    public function create(Request $request, Response $response): ResponseInterface
    {
        $postData = (array) $request->getParsedBody();
        if (empty($postData)) {
            throw new HttpBadRequestException($request, "No data was provided.");
        }

        $postData = Beneficiary::unserialize($postData);
        unset($postData['user'], $postData['user_id']);

        try {
            $beneficiary = Beneficiary::new($postData);
        } catch (ValidationsException $e) {
            $errors = Beneficiary::serializeValidation($e->getValidationErrors());
            throw new ValidationsException($errors);
        }

        $beneficiary = static::_formatOne($beneficiary);
        return $response->withJson($beneficiary, StatusCode::STATUS_CREATED);
    }

    public function update(Request $request, Response $response): ResponseInterface
    {
        $id = $request->getIntegerAttribute('id');
        $beneficiary = Beneficiary::findOrFail($id);

        $postData = (array) $request->getParsedBody();
        if (empty($postData)) {
            throw new HttpBadRequestException($request, "No data was provided.");
        }

        $postData = Beneficiary::unserialize($postData);
        if (!Auth::is(Group::ADMINISTRATION)) {
            unset($postData['user']);
        }

        try {
            $beneficiary->edit($postData);
        } catch (ValidationsException $e) {
            $errors = Beneficiary::serializeValidation($e->getValidationErrors());
            throw new ValidationsException($errors);
        }

        $beneficiary = static::_formatOne($beneficiary);
        return $response->withJson($beneficiary, StatusCode::STATUS_OK);
    }

    public function delete(Request $request, Response $response): ResponseInterface
    {
        $id = $request->getIntegerAttribute('id');
        $beneficiary = Beneficiary::withTrashed()->findOrFail($id);

        $isDeleted = $beneficiary->trashed()
            ? $beneficiary->forceDelete()
            : $beneficiary->delete();

        if (!$isDeleted) {
            throw new \RuntimeException("An unknown error occurred while deleting the beneficiary.");
        }

        return $response->withStatus(StatusCode::STATUS_NO_CONTENT);
    }

    public function restore(Request $request, Response $response): ResponseInterface
    {
        $id = $request->getIntegerAttribute('id');

        $beneficiary = Beneficiary::query()
            ->onlyTrashed()
            ->findOrFail($id);

        if (!$beneficiary->restore()) {
            throw new \RuntimeException(sprintf("Unable to restore the benficiary %d.", $id));
        }

        $data = static::_formatOne($beneficiary);
        return $response->withJson($data, StatusCode::STATUS_OK);
    }

    // ------------------------------------------------------
    // -
    // -    Méthodes internes
    // -
    // ------------------------------------------------------

    protected static function _formatOne(Beneficiary $beneficiary): array
    {
        return $beneficiary->serialize(Beneficiary::SERIALIZE_DETAILS);
    }
}
