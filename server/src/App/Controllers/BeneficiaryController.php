<?php
declare(strict_types=1);

namespace Loxya\Controllers;

use Fig\Http\Message\StatusCodeInterface as StatusCode;
use Illuminate\Database\Eloquent\Builder;
use Loxya\Controllers\Traits\Crud;
use Loxya\Errors\Exception\ValidationException;
use Loxya\Http\Request;
use Loxya\Models\Beneficiary;
use Loxya\Models\Event;
use Loxya\Models\Park;
use Loxya\Support\Database\QueryAggregator;
use Psr\Http\Message\ResponseInterface;
use Slim\Exception\HttpBadRequestException;
use Slim\Http\Response;

final class BeneficiaryController extends BaseController
{
    use Crud\GetOne;
    use Crud\SoftDelete;

    public function getAll(Request $request, Response $response): ResponseInterface
    {
        $search = $request->getSearchArrayQueryParam('search');
        $limit = $request->getIntegerQueryParam('limit');
        $ascending = $request->getBooleanQueryParam('ascending', true);
        $onlyDeleted = $request->getBooleanQueryParam('deleted', false);
        $orderBy = $request->getOrderByQueryParam('orderBy', Beneficiary::class);

        $query = Beneficiary::query()
            ->when(
                !empty($search),
                static fn (Builder $query) => $query->search($search),
            )
            ->when($onlyDeleted, static fn (Builder $builder) => (
                $builder->onlyTrashed()
            ))
            ->customOrderBy($orderBy, $ascending ? 'asc' : 'desc');

        $results = $this->paginate($request, $query, $limit);
        return $response->withJson($results, StatusCode::STATUS_OK);
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
        } catch (ValidationException $e) {
            $errors = Beneficiary::serializeValidation($e->getValidationErrors());
            throw new ValidationException($errors);
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
        unset($postData['user']);

        try {
            $beneficiary->edit($postData);
        } catch (ValidationException $e) {
            $errors = Beneficiary::serializeValidation($e->getValidationErrors());
            throw new ValidationException($errors);
        }

        $beneficiary = static::_formatOne($beneficiary);
        return $response->withJson($beneficiary, StatusCode::STATUS_OK);
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
