<?php
declare(strict_types=1);

namespace Loxya\Controllers;

use DI\Container;
use Fig\Http\Message\StatusCodeInterface as StatusCode;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Loxya\Config\Config;
use Loxya\Errors\Enums\ApiErrorCode;
use Loxya\Errors\Exception\ApiBadRequestException;
use Loxya\Errors\Exception\HttpUnprocessableEntityException;
use Loxya\Http\Request;
use Loxya\Models\Event;
use Loxya\Models\Park;
use Loxya\Services\Logger;
use Loxya\Services\Mailer;
use Loxya\Support\Database\QueryAggregator;
use Psr\Http\Message\ResponseInterface;
use Slim\Exception\HttpBadRequestException;
use Slim\Exception\HttpException;
use Slim\Http\Response;

final class BookingController extends BaseController
{
    public const MAX_GET_ALL_PER_PAGE = 30;

    public const BOOKING_TYPES = [
        Event::TYPE => Event::class,
    ];

    protected Mailer $mailer;
    protected Logger $logger;

    public function __construct(Container $container, Mailer $mailer, Logger $logger)
    {
        parent::__construct($container);

        $this->mailer = $mailer;
        $this->logger = $logger;
    }

    public function getAll(Request $request, Response $response): ResponseInterface
    {
        return $request->getBooleanQueryParam('paginated', true)
            ? $this->getAllPaginated($request, $response)
            : $this->getAllInPeriod($request, $response);
    }

    public function getOneSummary(Request $request, Response $response): ResponseInterface
    {
        $entity = $request->getRawEnumAttribute('entity', array_keys(self::BOOKING_TYPES));
        $id = $request->getIntegerAttribute('id');

        /** @var Event $booking */
        $booking = self::BOOKING_TYPES[$entity]::findOrFail($id);

        $useMultipleParks = Park::count() > 1;

        $data = array_replace(
            $booking->serialize($booking::SERIALIZE_BOOKING_SUMMARY),
            [
                'parks' => $useMultipleParks
                    ? array_values($booking->parks)
                    : [],
            ],
        );

        return $response->withJson($data, StatusCode::STATUS_OK);
    }

    public function getOne(Request $request, Response $response): ResponseInterface
    {
        $entity = $request->getRawEnumAttribute('entity', array_keys(self::BOOKING_TYPES));
        $id = $request->getIntegerAttribute('id');

        /** @var Event $booking */
        $booking = self::BOOKING_TYPES[$entity]::findOrFail($id);

        $data = $booking->serialize($booking::SERIALIZE_BOOKING_DEFAULT);
        return $response->withJson($data, StatusCode::STATUS_OK);
    }

    public function updateMaterials(Request $request, Response $response): ResponseInterface
    {
        $entity = $request->getRawEnumAttribute('entity', array_keys(self::BOOKING_TYPES));
        $id = $request->getIntegerAttribute('id');

        /** @var Event $booking */
        $booking = self::BOOKING_TYPES[$entity]::findOrFail($id);

        if (!$booking->is_editable) {
            throw new HttpUnprocessableEntityException($request, "This booking is no longer editable.");
        }

        $rawMaterials = $request->getParsedBody();
        if (!is_array($rawMaterials)) {
            throw new HttpBadRequestException($request, "No data was provided.");
        }

        try {
            $booking->syncMaterials($rawMaterials);
        } catch (\LengthException $e) {
            throw new ApiBadRequestException(ApiErrorCode::EMPTY_PAYLOAD, $e->getMessage());
        } catch (\InvalidArgumentException $e) {
            throw new HttpBadRequestException($request, $e->getMessage());
        }

        $data = $booking->serialize($booking::SERIALIZE_BOOKING_DEFAULT);
        return $response->withJson($data, StatusCode::STATUS_OK);
    }

    public function updateBilling(Request $request, Response $response): ResponseInterface
    {
        $entity = $request->getRawEnumAttribute('entity', array_keys(self::BOOKING_TYPES));
        $id = $request->getIntegerAttribute('id');

        /** @var Event $booking */
        $booking = self::BOOKING_TYPES[$entity]::findOrFail($id);

        if (!$booking->is_editable) {
            throw new HttpUnprocessableEntityException($request, "This booking is no longer editable.");
        }

        $rawBillingData = $request->getParsedBody();
        if (!is_array($rawBillingData)) {
            throw new HttpBadRequestException($request, "No data was provided.");
        }

        try {
            $booking->syncBilling($rawBillingData);
        } catch (\InvalidArgumentException $e) {
            throw new HttpBadRequestException($request, $e->getMessage());
        }

        $data = $booking->serialize($booking::SERIALIZE_BOOKING_DEFAULT);
        return $response->withJson($data, StatusCode::STATUS_OK);
    }

    // ------------------------------------------------------
    // -
    // -    Internal Methods
    // -
    // ------------------------------------------------------

    protected function getAllPaginated(Request $request, Response $response): ResponseInterface
    {
        $orderBy = $request->getStringQueryParam('orderBy', 'mobilization_start_date');
        $ascending = $request->getBooleanQueryParam('ascending');
        $limit = $request->getIntegerQueryParam('limit');

        $search = $request->getSearchArrayQueryParam('search');
        $categoryId = $request->getQueryParam('category');
        $parkId = $request->getIntegerQueryParam('park');
        $period = $request->getPeriodQueryParam('period');
        $endingToday = $request->getBooleanQueryParam('endingToday', false);
        $returnInventoryTodo = $request->getBooleanQueryParam('returnInventoryTodo', false);
        $notConfirmed = $request->getBooleanQueryParam('notConfirmed', false);
        $archived = $request->getBooleanQueryParam('archived', false);

        $queries = [];
        $queries[Event::class] = Event::query()
            ->when($categoryId === 'uncategorized' || is_numeric($categoryId), static fn (Builder $builder) => (
                $builder->whereHas('materials', static fn (Builder $eventMaterialQuery) => (
                    $eventMaterialQuery->whereHas('material', static fn (Builder $materialQuery) => (
                        $materialQuery->where('category_id', (
                            $categoryId !== 'uncategorized' ? (int) $categoryId : null
                        ))
                    ))
                ))
            ))
            ->when($parkId !== null, static fn (Builder $builder) => (
                $builder->havingMaterialInPark($parkId)
            ))
            ->when($notConfirmed, static fn (Builder $builder) => (
                $builder->where('is_confirmed', false)
            ))
            ->with(['materials', 'beneficiaries', 'technicians']);

        $query = (new QueryAggregator())->orderBy($orderBy, $ascending ? 'asc' : 'desc');
        foreach ($queries as $modelClass => $modelQuery) {
            $modelQuery
                ->when(
                    !empty($search),
                    static fn ($builder) => $builder->search($search),
                )
                ->when($period !== null, static fn (Builder $builder) => (
                    $builder->inPeriod($period, withOverdue: true)
                ))
                ->when($endingToday, static fn (Builder $builder) => (
                    $builder->endingToday()
                ))
                ->when($returnInventoryTodo, static fn (Builder $builder) => (
                    $builder->returnInventoryTodo()
                ))
                ->where('is_archived', $archived);

            $query->add($modelClass, $modelQuery);
        }

        $limit = is_numeric($limit) ? (int) $limit : self::MAX_GET_ALL_PER_PAGE;
        $results = $this->paginate($request, $query, min($limit, self::MAX_GET_ALL_PER_PAGE));

        $useMultipleParks = Park::count() > 1;

        $results['data'] = $results['data']->map(static fn ($booking) => array_merge(
            $booking->serialize($booking::SERIALIZE_BOOKING_EXCERPT),
            [
                'parks' => (
                    $useMultipleParks
                        ? array_values($booking->parks)
                        : []
                ),
            ],
        ));

        return $response->withJson($results, StatusCode::STATUS_OK);
    }

    protected function getAllInPeriod(Request $request, Response $response): ResponseInterface
    {
        $period = $request->getPeriodQueryParam('period');
        if ($period === null) {
            throw new HttpException(
                $request,
                sprintf('The period is required for non-paginated data.'),
                StatusCode::STATUS_NOT_ACCEPTABLE,
            );
        }

        // - Limitation de la période récupérable.
        $maxPeriodDuration = Config::get('maxFetchPeriod', 3 * 30) + 15;
        $maxEndDate = $period->getStartDate()->addDays($maxPeriodDuration);
        if ($period->getEndDate()->isAfter($maxEndDate)) {
            throw new HttpException(
                $request,
                sprintf('The retrieval period for bookings may not exceed %s days.', $maxPeriodDuration),
                StatusCode::STATUS_RANGE_NOT_SATISFIABLE,
            );
        }

        $query = new QueryAggregator([
            // - Événements.
            Event::class => (
                Event::inPeriod($period, withOverdue: true)
                    ->with(['materials', 'beneficiaries', 'technicians'])
            ),
        ]);

        /** @var Collection<array-key, Event> $bookings */
        $bookings = $query->get();
        if ($bookings->isEmpty()) {
            return $response->withJson([], StatusCode::STATUS_OK);
        }

        $useMultipleParks = Park::count() > 1;

        $data = $bookings
            ->map(static fn ($booking) => array_replace(
                $booking->serialize($booking::SERIALIZE_BOOKING_EXCERPT),
                [
                    'parks' => $useMultipleParks
                        ? array_values($booking->parks)
                        : [],
                ],
            ))
            ->all();

        return $response->withJson($data, StatusCode::STATUS_OK);
    }
}
