<?php
declare(strict_types=1);

namespace Loxya\Controllers;

use DI\Container;
use Fig\Http\Message\StatusCodeInterface as StatusCode;
use Illuminate\Database\Eloquent\Builder;
use Loxya\Config\Config;
use Loxya\Config\Enums\Feature;
use Loxya\Controllers\Traits\Crud;
use Loxya\Errors\Exception\ValidationException;
use Loxya\Http\Request;
use Loxya\Models\Document;
use Loxya\Models\Enums\Group;
use Loxya\Models\Event;
use Loxya\Models\EventTechnician;
use Loxya\Models\Technician;
use Loxya\Services\Auth;
use Loxya\Services\I18n;
use Loxya\Support\Arr;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\UploadedFileInterface;
use Slim\Exception\HttpBadRequestException;
use Slim\Exception\HttpException;
use Slim\Exception\HttpNotFoundException;
use Slim\Http\Response;

final class TechnicianController extends BaseController
{
    use Crud\GetOne {
        getOne as protected _originalGetOne;
    }
    use Crud\SoftDelete {
        delete as protected _originalDelete;
        restore as protected _originalRestore;
    }

    private I18n $i18n;

    public function __construct(Container $container, I18n $i18n)
    {
        parent::__construct($container);

        $this->i18n = $i18n;
    }

    // ------------------------------------------------------
    // -
    // -    Actions
    // -
    // ------------------------------------------------------

    public function getOne(Request $request, Response $response): ResponseInterface
    {
        if (!isFeatureEnabled(Feature::TECHNICIANS)) {
            throw new HttpNotFoundException($request, "Technician feature is disabled.");
        }
        return $this->_originalGetOne($request, $response);
    }

    public function getAll(Request $request, Response $response): ResponseInterface
    {
        if (!isFeatureEnabled(Feature::TECHNICIANS)) {
            throw new HttpNotFoundException($request, "Technician feature is disabled.");
        }

        $search = $request->getSearchArrayQueryParam('search');
        $limit = $request->getIntegerQueryParam('limit');
        $ascending = $request->getBooleanQueryParam('ascending', true);
        $availabilityPeriod = $request->getPeriodQueryParam('availabilityPeriod');
        $role = $request->getIntegerQueryParam('role');
        $onlyDeleted = $request->getBooleanQueryParam('deleted', false);
        $orderBy = $request->getOrderByQueryParam('orderBy', Technician::class);

        $query = Technician::query()
            ->when(
                !empty($search),
                static fn (Builder $subQuery) => $subQuery->search($search),
            )
            ->when(
                $availabilityPeriod !== null,
                static fn (Builder $subQuery) => (
                    $subQuery->whereDoesntHave('assignments', (
                        static function (Builder $subSubQuery) use ($availabilityPeriod) {
                            /** @var Builder|EventTechnician $subSubQuery */
                            $subSubQuery->inPeriod($availabilityPeriod);
                        }
                    ))
                ),
            )
            ->when($role !== null, static fn (Builder $subQuery) => (
                $subQuery->whereHas('roles', static fn (Builder $rolesQuery) => (
                    $rolesQuery->where('roles.id', $role)
                ))
            ))
            ->when($onlyDeleted, static fn (Builder $subQuery) => (
                $subQuery->onlyTrashed()
            ))
            ->customOrderBy($orderBy, $ascending ? 'asc' : 'desc');

        $results = $this->paginate($request, $query, $limit);
        return $response->withJson($results, StatusCode::STATUS_OK);
    }

    public function getAllWhileEvent(Request $request, Response $response): ResponseInterface
    {
        if (!isFeatureEnabled(Feature::TECHNICIANS)) {
            throw new HttpNotFoundException($request, "Technician feature is disabled.");
        }

        $eventId = $request->getIntegerAttribute('eventId');
        $role = $request->getIntegerQueryParam('role');
        $event = Event::findOrFail($eventId);

        $technicians = Technician::query()
            ->when($role !== null, static fn (Builder $subQuery) => (
                $subQuery->whereHas('roles', static fn (Builder $rolesQuery) => (
                    $rolesQuery->where('roles.id', $role)
                ))
            ))
            ->customOrderBy('full_name')->get()
            ->map(static function ($technician) use ($event) {
                $events = $technician->assignments()
                    ->whereHas('event', static function (Builder $query) use ($event) {
                        /** @var Builder|Event $query */
                        $query
                            ->inPeriod($event, withOverdue: false)
                            ->where('id', '!=', $event->id)
                            ->where('deleted_at', null);
                    })
                    ->get()
                    ->map(static fn (EventTechnician $eventTechnician) => (
                        $eventTechnician->serialize(
                            EventTechnician::SERIALIZE_FOR_TECHNICIAN,
                        )
                    ))
                    ->all();

                return array_replace($technician->serialize(), compact('events'));
            })
            ->all();

        return $response->withJson($technicians, StatusCode::STATUS_OK);
    }

    public function getAllWithAssignments(Request $request, Response $response): ResponseInterface
    {
        if (!isFeatureEnabled(Feature::TECHNICIANS)) {
            throw new HttpNotFoundException($request, "Technician feature is disabled.");
        }

        $paginated = $request->getBooleanQueryParam('paginated', true);
        $period = $request->getPeriodQueryParam('period');
        $limit = $request->getIntegerQueryParam('limit');

        if ($period === null) {
            throw new HttpException($request, 'The period is required.', StatusCode::STATUS_NOT_ACCEPTABLE);
        }

        // - Limitation de la période récupérable.
        $maxPeriodDuration = Config::get('maxFetchPeriod', 3 * 30) + 15;
        $maxEndDate = $period->getStartDate()->addDays($maxPeriodDuration);
        if ($period->getEndDate()->isAfter($maxEndDate)) {
            throw new HttpException(
                $request,
                sprintf(
                    'The retrieval period for assignments may not exceed %s days.',
                    $maxPeriodDuration,
                ),
                StatusCode::STATUS_RANGE_NOT_SATISFIABLE,
            );
        }

        $query = Technician::query()->customOrderBy('full_name');
        $results = $paginated
            ? $this->paginate($request, $query, $limit)
            : $query->get();

        $processor = static function (Technician $technician) use ($period) {
            $events = $technician->assignments()
                ->whereHas('event', static function (Builder $query) use ($period) {
                    /** @var Builder|Event $query */
                    $query
                        ->inPeriod($period, withOverdue: false)
                        ->where('deleted_at', null);
                })
                ->get()
                ->map(static fn (EventTechnician $eventTechnician) => (
                    $eventTechnician->serialize(
                        EventTechnician::SERIALIZE_FOR_TECHNICIAN,
                    )
                ))
                ->all();

            return array_replace($technician->serialize(), compact('events'));
        };

        if ($paginated) {
            $results['data'] = $results['data']->map($processor);
        } else {
            $results = $results->map($processor);
        }

        return $response->withJson($results, StatusCode::STATUS_OK);
    }

    public function getEvents(Request $request, Response $response): ResponseInterface
    {
        if (!isFeatureEnabled(Feature::TECHNICIANS)) {
            throw new HttpNotFoundException($request, "Technician feature is disabled.");
        }

        $id = $request->getAttribute('id');
        $technician = Technician::findOrFail($id);

        $data = $technician->assignments
            ->whereNull('event.deleted_at')
            ->values()
            ->map(
                static fn (EventTechnician $eventTechnician) => (
                    $eventTechnician->serialize(
                        EventTechnician::SERIALIZE_FOR_TECHNICIAN,
                    )
                ),
            );

        return $response->withJson($data, StatusCode::STATUS_OK);
    }

    public function getDocuments(Request $request, Response $response): ResponseInterface
    {
        if (!isFeatureEnabled(Feature::TECHNICIANS)) {
            throw new HttpNotFoundException($request, "Technician feature is disabled.");
        }

        $id = $request->getIntegerAttribute('id');
        $technician = Technician::findOrFail($id);

        return $response->withJson($technician->documents, StatusCode::STATUS_OK);
    }

    public function attachDocument(Request $request, Response $response): ResponseInterface
    {
        if (!isFeatureEnabled(Feature::TECHNICIANS)) {
            throw new HttpNotFoundException($request, "Technician feature is disabled.");
        }

        $id = $request->getIntegerAttribute('id');
        $technician = Technician::findOrFail($id);

        /** @var UploadedFileInterface[] $uploadedFiles */
        $uploadedFiles = $request->getUploadedFiles();
        if (count($uploadedFiles) !== 1) {
            throw new HttpBadRequestException($request, "Invalid number of files sent: a single file is expected.");
        }

        $file = array_values($uploadedFiles)[0];
        $document = new Document(compact('file'));
        $document->author()->associate(Auth::user());
        $technician->documents()->save($document);

        return $response->withJson($document, StatusCode::STATUS_CREATED);
    }

    public function create(Request $request, Response $response): ResponseInterface
    {
        if (!isFeatureEnabled(Feature::TECHNICIANS)) {
            throw new HttpNotFoundException($request, "Technician feature is disabled.");
        }

        $withUser = Auth::is(Group::ADMINISTRATION)
            ? $request->getBooleanQueryParam('withUser', false)
            : false;

        $postData = (array) $request->getParsedBody();
        if (empty($postData)) {
            throw new HttpBadRequestException($request, "No data was provided.");
        }

        $postData = Technician::unserialize($postData);
        if (!$withUser) {
            $postData = Arr::except($postData, ['user', 'user_id']);
        }

        try {
            $technician = Technician::new($postData, $withUser);
        } catch (ValidationException $e) {
            $errors = Technician::serializeValidation($e->getValidationErrors());
            throw new ValidationException($errors);
        }

        $technician = static::_formatOne($technician);
        return $response->withJson($technician, StatusCode::STATUS_CREATED);
    }

    public function update(Request $request, Response $response): ResponseInterface
    {
        if (!isFeatureEnabled(Feature::TECHNICIANS)) {
            throw new HttpNotFoundException($request, "Technician feature is disabled.");
        }

        $id = $request->getIntegerAttribute('id');
        $withUser = Auth::is(Group::ADMINISTRATION)
            ? $request->getBooleanQueryParam('withUser', false)
            : false;

        $technician = Technician::findOrFail($id);

        $postData = (array) $request->getParsedBody();
        if (empty($postData)) {
            throw new HttpBadRequestException($request, "No data was provided.");
        }

        $postData = Technician::unserialize($postData);
        if (!$withUser) {
            $postData = Arr::except($postData, ['user', 'user_id']);
        }

        try {
            $technician->edit($postData, $withUser);
        } catch (ValidationException $e) {
            $errors = Technician::serializeValidation($e->getValidationErrors());
            throw new ValidationException($errors);
        }

        $technician = static::_formatOne($technician);
        return $response->withJson($technician, StatusCode::STATUS_OK);
    }

    public function delete(Request $request, Response $response): ResponseInterface
    {
        if (!isFeatureEnabled(Feature::TECHNICIANS)) {
            throw new HttpNotFoundException($request, "Technician feature is disabled.");
        }
        return $this->_originalDelete($request, $response);
    }

    public function restore(Request $request, Response $response): ResponseInterface
    {
        if (!isFeatureEnabled(Feature::TECHNICIANS)) {
            throw new HttpNotFoundException($request, "Technician feature is disabled.");
        }
        return $this->_originalRestore($request, $response);
    }

    // ------------------------------------------------------
    // -
    // -    Méthodes internes
    // -
    // ------------------------------------------------------

    protected static function _formatOne(Technician $technician): array
    {
        return $technician->serialize(Technician::SERIALIZE_DETAILS);
    }
}
