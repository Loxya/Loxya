<?php
declare(strict_types=1);

namespace Loxya\Controllers;

use Carbon\Carbon;
use Carbon\CarbonImmutable;
use Carbon\Exceptions\InvalidFormatException;
use DI\Container;
use Fig\Http\Message\StatusCodeInterface as StatusCode;
use Illuminate\Database\Eloquent\Builder;
use Loxya\Config\Enums\Feature;
use Loxya\Controllers\Traits\Crud;
use Loxya\Errors\Exception\HttpConflictException;
use Loxya\Errors\Exception\HttpUnprocessableEntityException;
use Loxya\Errors\Exception\ValidationException;
use Loxya\Http\Request;
use Loxya\Models\Document;
use Loxya\Models\Enums\Group;
use Loxya\Models\Estimate;
use Loxya\Models\Event;
use Loxya\Models\EventMaterial;
use Loxya\Models\EventPosition;
use Loxya\Models\EventTechnician;
use Loxya\Models\Invoice;
use Loxya\Services\Auth;
use Loxya\Services\I18n;
use Loxya\Services\Logger;
use Loxya\Services\Mailer;
use Loxya\Support\Arr;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\UploadedFileInterface;
use Slim\Exception\HttpBadRequestException;
use Slim\Exception\HttpForbiddenException;
use Slim\Exception\HttpNotFoundException;
use Slim\Http\Response;

final class EventController extends BaseController
{
    use Crud\SoftDelete;

    private I18n $i18n;
    protected Mailer $mailer;
    protected Logger $logger;

    public function __construct(Container $container, I18n $i18n, Mailer $mailer, Logger $logger)
    {
        parent::__construct($container);

        $this->i18n = $i18n;
        $this->mailer = $mailer;
        $this->logger = $logger;
    }

    // ------------------------------------------------------
    // -
    // -    Actions
    // -
    // ------------------------------------------------------

    public function getAll(Request $request, Response $response): ResponseInterface
    {
        $search = $request->getSearchArrayQueryParam('search');
        $exclude = $request->getIntegerQueryParam('exclude');

        $query = Event::query()
            ->when(
                !empty($search),
                static fn ($builder) => $builder->search($search),
            )
            ->when($exclude !== null, static fn (Builder $subQuery) => (
                $subQuery->where('id', '<>', $exclude)
            ))
            ->orderBy('mobilization_start_date', 'desc')
            ->whereHas('materials', static fn (Builder $eventMaterialQuery) => (
                $eventMaterialQuery->whereHas('material', static fn (Builder $materialQuery) => (
                    $materialQuery->withoutTrashed()
                ))
            ));

        return $response->withJson([
            'count' => $query->count(),
            'data' => $query
                ->limit(10)->get()
                ->map(static fn (Event $event) => (
                    $event->serialize(Event::SERIALIZE_SUMMARY)
                )),
        ]);
    }

    public function getOne(Request $request, Response $response): ResponseInterface
    {
        $id = $request->getIntegerAttribute('id');
        $event = Event::findOrFail($id);

        return $response->withJson(static::_formatOne($event), StatusCode::STATUS_OK);
    }

    public function getMissingMaterials(Request $request, Response $response): ResponseInterface
    {
        $id = $request->getIntegerAttribute('id');

        $missingMaterials = Event::findOrFail($id)
            ->missingMaterials()
            ->map(static fn (EventMaterial $material) => (
                $material->serialize(EventMaterial::SERIALIZE_WITH_QUANTITY_MISSING)
            ));

        return $response->withJson($missingMaterials, StatusCode::STATUS_OK);
    }

    public function getDocuments(Request $request, Response $response): ResponseInterface
    {
        $id = $request->getIntegerAttribute('id');
        $event = Event::findOrFail($id);

        return $response->withJson($event->documents, StatusCode::STATUS_OK);
    }

    public function getOnePdf(Request $request, Response $response): ResponseInterface
    {
        $id = $request->getIntegerAttribute('id');
        $event = Event::findOrFail($id);

        $sortedBy = $request->getRawEnumQueryParam('sortedBy', ['lists', 'parks'], 'lists');
        $pdf = $event->toPdf($this->i18n, $sortedBy);

        return $pdf->asResponse($response);
    }

    public function create(Request $request, Response $response): ResponseInterface
    {
        $postData = Event::unserialize((array) $request->getParsedBody());
        if (empty($postData)) {
            throw new HttpBadRequestException($request, "No data was provided.");
        }

        try {
            $event = Event::new(array_replace($postData, ['author_id' => Auth::user()->id]));
        } catch (ValidationException $e) {
            $errors = Event::serializeValidation($e->getValidationErrors());
            throw new ValidationException($errors);
        }

        return $response->withJson(static::_formatOne($event), StatusCode::STATUS_CREATED);
    }

    public function createAssignment(Request $request, Response $response): ResponseInterface
    {
        if (!isFeatureEnabled(Feature::TECHNICIANS)) {
            throw new HttpNotFoundException($request, "Technician feature is disabled.");
        }

        $id = $request->getIntegerAttribute('id');
        $event = Event::findOrFail($id);

        if (!$event->is_editable) {
            throw new HttpUnprocessableEntityException($request, "This event is no longer editable.");
        }

        $postData = EventTechnician::unserialize((array) $request->getParsedBody());
        if (empty($postData)) {
            throw new HttpBadRequestException($request, "No data was provided.");
        }

        try {
            $newAssignment = EventTechnician::new(array_replace($postData, ['event_id' => $id]));
        } catch (ValidationException $e) {
            $errors = EventTechnician::serializeValidation($e->getValidationErrors());
            throw new ValidationException($errors);
        }

        return $response->withJson($newAssignment, StatusCode::STATUS_CREATED);
    }

    public function updateAssignment(Request $request, Response $response): ResponseInterface
    {
        if (!isFeatureEnabled(Feature::TECHNICIANS)) {
            throw new HttpNotFoundException($request, "Technician feature is disabled.");
        }

        $id = $request->getIntegerAttribute('id');
        $assignmentId = $request->getIntegerAttribute('assignmentId');
        $event = Event::findOrFail($id);

        if (!$event->is_editable) {
            throw new HttpUnprocessableEntityException($request, "This event is no longer editable.");
        }

        /** @var EventTechnician $assignment */
        $assignment = $event->technicians()
            ->findOrFail($assignmentId);

        $postData = EventTechnician::unserialize((array) $request->getParsedBody());
        if (empty($postData)) {
            throw new HttpBadRequestException($request, "No data was provided.");
        }

        try {
            $assignment->edit(Arr::except($postData, ['event_id']));
        } catch (ValidationException $e) {
            $errors = EventTechnician::serializeValidation($e->getValidationErrors());
            throw new ValidationException($errors);
        }

        return $response->withJson($assignment, StatusCode::STATUS_OK);
    }

    public function deleteAssignment(Request $request, Response $response): ResponseInterface
    {
        if (!isFeatureEnabled(Feature::TECHNICIANS)) {
            throw new HttpNotFoundException($request, "Technician feature is disabled.");
        }

        $id = $request->getIntegerAttribute('id');
        $assignmentId = $request->getIntegerAttribute('assignmentId');
        $event = Event::findOrFail($id);

        if (!$event->is_editable) {
            throw new HttpUnprocessableEntityException($request, "This event is no longer editable.");
        }

        /** @var EventTechnician $eventTechnician */
        $eventTechnician = $event->technicians()
            ->findOrFail($assignmentId);

        if (!$eventTechnician->delete()) {
            throw new \RuntimeException(sprintf(
                'An unknown error occurred while deleting the event technician #%d.',
                $eventTechnician->id,
            ));
        }

        return $response->withStatus(StatusCode::STATUS_NO_CONTENT);
    }

    public function createPosition(Request $request, Response $response): ResponseInterface
    {
        if (!isFeatureEnabled(Feature::TECHNICIANS)) {
            throw new HttpNotFoundException($request, "Technician feature is disabled.");
        }

        $id = $request->getIntegerAttribute('id');
        $event = Event::findOrFail($id);

        if (!$event->is_editable) {
            throw new HttpUnprocessableEntityException($request, "This event is no longer editable.");
        }

        $postData = EventPosition::unserialize((array) $request->getParsedBody());
        if (empty($postData)) {
            throw new HttpBadRequestException($request, "No data was provided.");
        }

        try {
            $newPosition = EventPosition::new(array_replace($postData, ['event_id' => $id]));
        } catch (ValidationException $e) {
            $errors = EventPosition::serializeValidation($e->getValidationErrors());
            throw new ValidationException($errors);
        }

        return $response->withJson($newPosition, StatusCode::STATUS_CREATED);
    }

    public function deletePosition(Request $request, Response $response): ResponseInterface
    {
        if (!isFeatureEnabled(Feature::TECHNICIANS)) {
            throw new HttpNotFoundException($request, "Technician feature is disabled.");
        }

        $id = $request->getIntegerAttribute('id');
        $positionId = $request->getIntegerAttribute('positionId');
        $event = Event::findOrFail($id);

        if (!$event->is_editable) {
            throw new HttpUnprocessableEntityException($request, "This event is no longer editable.");
        }

        /** @var EventPosition $eventPosition */
        $eventPosition = $event->positions()
            ->where(['role_id' => $positionId])
            ->firstOrFail();

        if (!$eventPosition->delete()) {
            throw new \RuntimeException(sprintf(
                'An unknown error occurred while deleting the event position #%d.',
                $eventPosition->id,
            ));
        }

        return $response->withStatus(StatusCode::STATUS_NO_CONTENT);
    }

    public function update(Request $request, Response $response): ResponseInterface
    {
        $id = $request->getIntegerAttribute('id');
        $event = Event::findOrFail($id);

        if (!$event->is_editable) {
            throw new HttpUnprocessableEntityException($request, "This event is no longer editable.");
        }

        $postData = Event::unserialize((array) $request->getParsedBody());
        if (empty($postData)) {
            throw new HttpBadRequestException($request, "No data was provided.");
        }

        try {
            $event->edit($postData);
        } catch (ValidationException $e) {
            $errors = Event::serializeValidation($e->getValidationErrors());
            throw new ValidationException($errors);
        }

        return $response->withJson(static::_formatOne($event), StatusCode::STATUS_OK);
    }

    public function updateNote(Request $request, Response $response): ResponseInterface
    {
        $id = $request->getIntegerAttribute('id');
        $event = Event::findOrFail($id);

        if (!Auth::is([Group::ADMINISTRATION, Group::SUPERVISION, Group::OPERATION])) {
            throw new HttpForbiddenException($request);
        }

        $event->note = $request->getParsedBodyParam('note');
        $event->save();

        return $response->withJson(static::_formatOne($event), StatusCode::STATUS_OK);
    }

    public function duplicate(Request $request, Response $response): ResponseInterface
    {
        $id = $request->getIntegerAttribute('id');
        $originalEvent = Event::findOrFail($id);

        $postData = (array) $request->getParsedBody();
        $eventData = Event::unserialize(Arr::except($postData, ['keepBillingData']));
        $keepBillingData = is_bool($postData['keepBillingData'] ?? null)
            ? $postData['keepBillingData']
            : false;

        if (empty($eventData)) {
            throw new HttpBadRequestException($request, "No data was provided.");
        }

        try {
            $newEvent = $originalEvent->duplicate($eventData, $keepBillingData, Auth::user());
        } catch (ValidationException $e) {
            $errors = Event::serializeValidation($e->getValidationErrors());
            throw new ValidationException($errors);
        }

        $data = $newEvent->serialize(Event::SERIALIZE_DETAILS);
        return $response->withJson($data, StatusCode::STATUS_CREATED);
    }

    public function updateDepartureInventory(Request $request, Response $response): ResponseInterface
    {
        $id = $request->getIntegerAttribute('id');
        $event = Event::findOrFail($id);

        if ($event->is_archived) {
            throw new HttpUnprocessableEntityException($request, "This event is archived.");
        }

        // - Si l'inventaire de départ est déjà terminé.
        if ($event->is_departure_inventory_done) {
            throw new HttpConflictException($request, "This event's departure inventory is already done.");
        }

        // - Si l'inventaire de départ ne peut pas encore être commencé.
        if (!$event->is_departure_inventory_period_open) {
            throw new HttpUnprocessableEntityException($request, (
                "This event's departure inventory cannot be done yet."
            ));
        }

        // -  Si l'inventaire de départ ne peut plus être effectué.
        if ($event->is_departure_inventory_period_closed) {
            throw new HttpUnprocessableEntityException($request, (
                "This event's departure inventory can no longer be done."
            ));
        }

        // - Si l'événement ne contient pas de matériel, il n'y a pas d'inventaire à faire.
        if ($event->materials->isEmpty()) {
            throw new HttpUnprocessableEntityException($request, (
                "This event contains no material, so there can be no inventory."
            ));
        }

        // - S'il y a du matériel manquant, on ne peut pas faire l'inventaire de départ.
        if ($event->has_missing_materials) {
            throw new HttpUnprocessableEntityException($request, (
                "This event contains shortage that should be fixed " .
                "before proceeding with the departure inventory."
            ));
        }

        $rawInventory = $request->getParsedBody();
        if (!is_array($rawInventory) && $rawInventory !== null) {
            throw new HttpBadRequestException($request, "Invalid data format.");
        }

        if (empty($rawInventory)) {
            throw new HttpBadRequestException($request, "No data was provided.");
        }

        try {
            $event->updateDepartureInventory($rawInventory);
        } catch (\InvalidArgumentException $e) {
            throw new HttpBadRequestException($request, $e->getMessage());
        }

        return $response->withJson(static::_formatOne($event), StatusCode::STATUS_OK);
    }

    public function finishDepartureInventory(Request $request, Response $response): ResponseInterface
    {
        $id = $request->getIntegerAttribute('id');
        $event = Event::findOrFail($id);

        if ($event->is_archived) {
            throw new HttpUnprocessableEntityException($request, "This event is archived.");
        }

        // - Si l'inventaire de départ est déjà terminé.
        if ($event->is_departure_inventory_done) {
            throw new HttpConflictException($request, "This event's departure inventory is already done.");
        }

        // - Si l'inventaire de départ ne peut pas encore être commencé.
        if (!$event->is_departure_inventory_period_open) {
            throw new HttpUnprocessableEntityException($request, (
                "This event's departure inventory cannot be done yet."
            ));
        }

        // -  Si l'inventaire de départ ne peut plus être effectué.
        if ($event->is_departure_inventory_period_closed) {
            throw new HttpUnprocessableEntityException($request, (
                "This event's departure inventory can no longer be done."
            ));
        }

        // - Si l'événement ne contient pas de matériel, il n'y a pas d'inventaire à faire.
        if ($event->materials->isEmpty()) {
            throw new HttpUnprocessableEntityException($request, (
                "This event contains no material, so there can be no inventory."
            ));
        }

        // - S'il y a du matériel manquant, on ne peut pas faire l'inventaire de départ.
        if ($event->has_missing_materials) {
            throw new HttpUnprocessableEntityException($request, (
                "This event contains shortage that should be fixed " .
                "before proceeding with the departure inventory."
            ));
        }

        $rawInventory = $request->getParsedBody();
        if (!empty($rawInventory)) {
            if (!is_array($rawInventory)) {
                throw new HttpBadRequestException($request, "Invalid data format.");
            }

            try {
                $event->updateDepartureInventory($rawInventory);
            } catch (\InvalidArgumentException) {
                throw new HttpBadRequestException($request, "Invalid data format.");
            }
        }

        if (!$event->can_finish_departure_inventory) {
            throw new HttpUnprocessableEntityException($request, (
                "This event's departure inventory cannot be marked as finished."
            ));
        }
        $event->finishDepartureInventory(Auth::user());

        return $response->withJson(static::_formatOne($event), StatusCode::STATUS_OK);
    }

    public function cancelDepartureInventory(Request $request, Response $response): ResponseInterface
    {
        $id = $request->getIntegerAttribute('id');
        $event = Event::findOrFail($id);

        if ($event->is_archived) {
            throw new HttpUnprocessableEntityException($request, "This event is archived.");
        }

        // - Si l'inventaire de départ n'est pas terminé, il n'y a rien à annuler.
        if (!$event->is_departure_inventory_done) {
            throw new HttpBadRequestException($request, "This event's departure inventory is not done.");
        }

        // - Si l'inventaire de retour est déjà terminé, on ne peut plus annuler l'inventaire de départ.
        if ($event->is_return_inventory_done) {
            throw new HttpUnprocessableEntityException($request, (
                "This event's return inventory is already done, the departure inventory can no longer be cancelled."
            ));
        }

        // - Si le début de l'événement est dans le passé, on ne peut plus annuler l'inventaire de départ.
        if ($event->operation_period->isPastOrOngoing()) {
            throw new HttpUnprocessableEntityException($request, (
                "This event has already started, the departure inventory can no longer be cancelled."
            ));
        }

        $event->cancelDepartureInventory();
        return $response->withJson(static::_formatOne($event), StatusCode::STATUS_OK);
    }

    public function updateReturnInventory(Request $request, Response $response): ResponseInterface
    {
        $id = $request->getIntegerAttribute('id');
        $event = Event::findOrFail($id);

        if ($event->is_archived) {
            throw new HttpUnprocessableEntityException($request, "This event is archived.");
        }

        // - Si l'inventaire de retour est déjà terminé.
        if ($event->is_return_inventory_done) {
            throw new HttpConflictException($request, "This event's return inventory is already done.");
        }

        // - Si l'inventaire de retour ne peut pas encore être commencé.
        if (!$event->is_return_inventory_period_open) {
            throw new HttpUnprocessableEntityException($request, (
                "This event's return inventory cannot be done yet."
            ));
        }

        // - Si l'événement ne contient pas de matériel, il n'y a pas d'inventaire à faire.
        if ($event->materials->isEmpty()) {
            throw new HttpUnprocessableEntityException($request, (
                "This event contains no material, so there can be no inventory."
            ));
        }

        // - S'il y a du matériel manquant, on ne peut pas faire l'inventaire de retour.
        if ($event->has_missing_materials) {
            throw new HttpUnprocessableEntityException($request, (
                "This event contains shortage that should be fixed " .
                "before proceeding with the return inventory."
            ));
        }

        $rawInventory = $request->getParsedBody();
        if (!is_array($rawInventory) && $rawInventory !== null) {
            throw new HttpBadRequestException($request, "Invalid data format.");
        }

        if (empty($rawInventory)) {
            throw new HttpBadRequestException($request, "No data was provided.");
        }

        try {
            $event->updateReturnInventory($rawInventory);
        } catch (\InvalidArgumentException $e) {
            throw new HttpBadRequestException($request, $e->getMessage());
        }

        return $response->withJson(static::_formatOne($event), StatusCode::STATUS_OK);
    }

    public function finishReturnInventory(Request $request, Response $response): ResponseInterface
    {
        $id = $request->getIntegerAttribute('id');
        $event = Event::findOrFail($id);

        if ($event->is_archived) {
            throw new HttpUnprocessableEntityException($request, "This event is archived.");
        }

        // - Si l'inventaire de retour est déjà terminé.
        if ($event->is_return_inventory_done) {
            throw new HttpConflictException($request, "This event's return inventory is already done.");
        }

        // - Si l'inventaire de retour ne peut pas encore être commencé.
        if (!$event->is_return_inventory_period_open) {
            throw new HttpUnprocessableEntityException($request, (
                "This event's return inventory cannot be done yet."
            ));
        }

        // - Si l'événement ne contient pas de matériel, il n'y a pas d'inventaire à faire.
        if ($event->materials->isEmpty()) {
            throw new HttpUnprocessableEntityException($request, (
                "This event contains no material, so there can be no inventory."
            ));
        }

        // - S'il y a du matériel manquant, on ne peut pas faire l'inventaire de retour.
        if ($event->has_missing_materials) {
            throw new HttpUnprocessableEntityException($request, (
                "This event contains shortage that should be fixed " .
                "before proceeding with the return inventory."
            ));
        }

        // - Date d'inventaire personnalisée.
        $date = null;
        $rawInventoryDate = $request->getParsedBodyParam('date');
        if ($rawInventoryDate !== null) {
            try {
                $date = Carbon::parse($rawInventoryDate);
            } catch (InvalidFormatException) {
                throw new HttpBadRequestException($request, "Invalid data format.");
            }
        }

        $rawInventory = $request->getParsedBodyParam('inventory', []);
        if (!empty($rawInventory)) {
            if (!is_array($rawInventory)) {
                throw new HttpBadRequestException($request, "Invalid data format.");
            }

            try {
                $event->updateReturnInventory($rawInventory);
            } catch (\InvalidArgumentException) {
                throw new HttpBadRequestException($request, "Invalid data format.");
            }
        }

        if (!$event->can_finish_return_inventory) {
            throw new HttpUnprocessableEntityException($request, (
                "This event's return inventory cannot be marked as finished."
            ));
        }
        $event->finishReturnInventory(Auth::user(), $date);

        return $response->withJson(static::_formatOne($event), StatusCode::STATUS_OK);
    }

    public function cancelReturnInventory(Request $request, Response $response): ResponseInterface
    {
        $id = $request->getIntegerAttribute('id');
        $event = Event::findOrFail($id);

        if ($event->is_archived) {
            throw new HttpUnprocessableEntityException($request, "This event is archived.");
        }

        // - Si l'inventaire de retour n'est pas terminé, il n'y a rien à annuler.
        if (!$event->is_return_inventory_done) {
            throw new HttpBadRequestException($request, "This event's return inventory is not done.");
        }

        // - S'il n'y a pas de matériel cassé, on permet l'annulation de
        //   l'inventaire quelque soit le moment ou il a été terminé.
        //   Sinon, l'inventaire est annulable pendant 1 semaine après
        //   l'avoir marqué comme terminé.
        if ($event->has_materials_returned_broken) {
            $isCancellable = (
                $event->return_inventory_datetime !== null &&
                CarbonImmutable::parse($event->return_inventory_datetime)
                    ->isAfter(Carbon::now()->subWeek())
            );
            if (!$isCancellable) {
                throw new HttpUnprocessableEntityException($request, (
                    "This event's return inventory can no longer been cancelled."
                ));
            }
        }

        $event->cancelReturnInventory();
        return $response->withJson(static::_formatOne($event), StatusCode::STATUS_OK);
    }

    public function createEstimate(Request $request, Response $response): ResponseInterface
    {
        $id = $request->getIntegerAttribute('id');
        $event = Event::findOrFail($id);

        $estimate = Estimate::createFromBooking($event, Auth::user());
        return $response->withJson($estimate, StatusCode::STATUS_CREATED);
    }

    public function createInvoice(Request $request, Response $response): ResponseInterface
    {
        $id = $request->getIntegerAttribute('id');
        $event = Event::findOrFail($id);

        $invoice = Invoice::createFromBooking($event, Auth::user());
        return $response->withJson($invoice, StatusCode::STATUS_CREATED);
    }

    public function attachDocument(Request $request, Response $response): ResponseInterface
    {
        $id = $request->getIntegerAttribute('id');
        $event = Event::findOrFail($id);

        /** @var UploadedFileInterface[] $uploadedFiles */
        $uploadedFiles = $request->getUploadedFiles();
        if (count($uploadedFiles) !== 1) {
            throw new HttpBadRequestException($request, "Invalid number of files sent: a single file is expected.");
        }

        $file = array_values($uploadedFiles)[0];
        $document = new Document(compact('file'));
        $document->author()->associate(Auth::user());
        $event->documents()->save($document);

        return $response->withJson($document, StatusCode::STATUS_CREATED);
    }

    public function archive(Request $request, Response $response): ResponseInterface
    {
        $id = $request->getIntegerAttribute('id');
        $event = Event::findOrFail($id);

        $event->is_archived = true;
        $event->save();

        return $response->withJson(static::_formatOne($event), StatusCode::STATUS_OK);
    }

    public function unarchive(Request $request, Response $response): ResponseInterface
    {
        $id = $request->getIntegerAttribute('id');
        $event = Event::findOrFail($id);

        $event->is_archived = false;
        $event->save();

        return $response->withJson(static::_formatOne($event), StatusCode::STATUS_OK);
    }

    public function delete(Request $request, Response $response): ResponseInterface
    {
        $id = $request->getIntegerAttribute('id');
        $event = Event::withTrashed()
            ->orWhere(static function ($query) {
                $query
                    ->where('is_confirmed', false)
                    ->where('is_return_inventory_done', false);
            })
            ->findOrFail($id);

        $isDeleted = $event->trashed()
            ? $event->forceDelete()
            : $event->delete();

        if (!$isDeleted) {
            throw new \RuntimeException("An unknown error occurred while deleting the event.");
        }

        return $response->withStatus(StatusCode::STATUS_NO_CONTENT);
    }

    // ------------------------------------------------------
    // -
    // -    Internal Methods
    // -
    // ------------------------------------------------------

    protected static function _formatOne(Event $event): array
    {
        return $event->serialize(Event::SERIALIZE_DETAILS);
    }
}
