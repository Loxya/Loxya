<?php
declare(strict_types=1);

namespace Loxya\Controllers;

use Brick\Math\BigDecimal as Decimal;
use Fig\Http\Message\StatusCodeInterface as StatusCode;
use Illuminate\Database\Eloquent\Builder;
use Loxya\Config\Config;
use Loxya\Config\Enums\BillingMode;
use Loxya\Errors\Exception\HttpConflictException;
use Loxya\Errors\Exception\HttpUnprocessableEntityException;
use Loxya\Http\Request;
use Loxya\Models\Beneficiary;
use Loxya\Models\Enums\EstimateStatus;
use Loxya\Models\Estimate;
use Loxya\Models\Invoice;
use Loxya\Services\Auth;
use Loxya\Support\Arr;
use Loxya\Support\Validation\ValidationsException;
use Loxya\Support\Validation\Validator as V;
use Psr\Http\Message\ResponseInterface;
use Slim\Exception\HttpBadRequestException;
use Slim\Exception\HttpNotFoundException;
use Slim\Http\Response;

final class EstimateController extends BaseController
{
    public function getAll(Request $request, Response $response): ResponseInterface
    {
        if (Config::get('billingMode') === BillingMode::NONE) {
            throw new HttpNotFoundException($request);
        }

        $search = $request->getSearchArrayQueryParam('search');
        $limit = $request->getIntegerQueryParam('limit');
        $orderBy = $request->getOrderByQueryParams('orderBy', 'ascending', Estimate::class);

        // - Filtres
        $date = $request->getComplexDateQueryParam('date', ['=', '<', '>']);
        $dueDate = $request->getComplexDateQueryParam('dueDate', ['=', '<', '>']);
        $amount = $request->getComplexNumericQueryParam('amount', ['=', '<', '>']);
        $statuses = $request->getEnumArrayQueryParam('status', EstimateStatus::class);

        $query = Estimate::query()
            ->when(!empty($search), static fn (Builder $subQuery) => (
                $subQuery->search($search)
            ))
            ->when(!empty($statuses), static fn (Builder $subQuery) => (
                $subQuery->withStatus($statuses)
            ))
            ->when($date !== null, static fn (Builder $subQuery) => (
                $subQuery->whereDate('date', $date['operator'], $date['value'])
            ))
            ->when($dueDate !== null, static fn (Builder $subQuery) => (
                $subQuery->where(static fn (Builder $subQuery) => (
                    $subQuery
                        // - Si on cherche à savoir si la date d'échéance est postérieure à une date
                        //   et qu'il n'y a pas de date d'échéance, alors elle est forcément après.
                        ->when($dueDate['operator'] === '>', static fn (Builder $subSubQuery) => (
                            $subSubQuery->orWhereNull('due_date')
                        ))
                        ->orWhere(static fn (Builder $subSubQuery) => (
                            $subSubQuery
                                ->whereNotNull('due_date')
                                ->whereDate('due_date', $dueDate['operator'], $dueDate['value'])
                        ))
                ))
            ))
            ->when($amount !== null, static fn (Builder $subQuery) => (
                $subQuery->where('total_without_taxes', $amount['operator'], $amount['value'])
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
        $estimate = Estimate::findOrFail($id);

        $data = $estimate->serialize(Estimate::SERIALIZE_DETAILS);
        return $response->withJson($data, StatusCode::STATUS_OK);
    }

    public function getOnePdf(Request $request, Response $response): ResponseInterface
    {
        $id = $request->getIntegerAttribute('id');
        $estimate = Estimate::findOrFail($id);

        return $estimate->toPdf()->asResponse($response);
    }

    public function updateStatus(Request $request, Response $response): ResponseInterface
    {
        $id = $request->getIntegerAttribute('id');
        $estimate = Estimate::findOrFail($id);

        $newStatus = $request->getParsedBodyParam('status');
        if ($newStatus === null) {
            throw new HttpBadRequestException($request, "Missing required status.");
        }

        // - Les statuts dérivés ne sont pas modifiables manuellement, tout
        //   comme le statut "brouillon" qui ne peut être assigné que via
        //   la création initiale.
        $assignableStatuses = [
            EstimateStatus::PENDING->value,
            EstimateStatus::SENT->value,
            EstimateStatus::ACCEPTED->value,
            EstimateStatus::REJECTED->value,
        ];
        if (!in_array($newStatus, $assignableStatuses, true)) {
            throw new HttpBadRequestException($request, "This status cannot be set manually.");
        }

        $estimate->status = $newStatus;
        $estimate->save();

        $data = $estimate->refresh()->serialize(Estimate::SERIALIZE_DETAILS);
        return $response->withJson($data, StatusCode::STATUS_OK);
    }

    public function finalize(Request $request, Response $response): ResponseInterface
    {
        $id = $request->getIntegerAttribute('id');
        $estimate = Estimate::findOrFail($id);

        if (!$estimate->is_draft) {
            throw new HttpUnprocessableEntityException($request, (
                "Only draft estimates can be finalized."
            ));
        }

        try {
            $estimate = $estimate->finalize();
        } catch (\DomainException $e) {
            throw new HttpUnprocessableEntityException($request, $e->getMessage());
        }

        $data = $estimate->serialize(Estimate::SERIALIZE_DETAILS);
        return $response->withJson($data, StatusCode::STATUS_OK);
    }

    public function create(Request $request, Response $response): ResponseInterface
    {
        if (Config::get('billingMode') === BillingMode::NONE) {
            throw new HttpNotFoundException($request);
        }

        $postData = (array) $request->getParsedBody();
        if (empty($postData)) {
            throw new HttpBadRequestException($request, "No data was provided.");
        }

        $buyerId = Arr::pull($postData, 'buyer_id');
        if ($buyerId === null) {
            throw new ValidationsException(['buyer_id' => __('mandatory-field')]);
        }

        $buyer = is_int($buyerId) || ctype_digit((string) $buyerId)
            ? Beneficiary::find((int) $buyerId)
            : null;

        if ($buyer === null) {
            throw new ValidationsException(['buyer_id' => __('invalid-field')]);
        }

        try {
            $estimate = Estimate::createFromScratch($buyer, $postData, Auth::user());
        } catch (\InvalidArgumentException) {
            throw new HttpBadRequestException($request);
        }

        $payload = $estimate->serialize(Estimate::SERIALIZE_DETAILS);
        return $response->withJson($payload, StatusCode::STATUS_CREATED);
    }

    public function createInvoice(Request $request, Response $response): ResponseInterface
    {
        if (Config::get('billingMode') === BillingMode::NONE) {
            throw new HttpNotFoundException($request);
        }

        $id = $request->getIntegerAttribute('id');
        $estimate = Estimate::findOrFail($id);

        // - Le montant éventuel de l'acompte, ou `null` si facture de solde.
        $amount = $request->getParsedBodyParam('amount');

        // - On vérifie le montant à facturer avant de le passer.
        $amountError = V::nullable(V::floatVal()->positive())->diagnose($amount);
        if ($amountError !== null) {
            throw new ValidationsException(['amount' => $amountError]);
        }

        $additionalData = Arr::only(
            (array) $request->getParsedBody(),
            [
                'lang',
                'due_date',
                'order_number',
                'special_mentions',
            ],
        );

        try {
            $invoice = Invoice::createFromEstimate(
                $estimate,
                $amount !== null ? Decimal::of($amount) : null,
                Auth::user(),
                $additionalData,
            );
        } catch (\InvalidArgumentException $e) {
            throw new HttpUnprocessableEntityException($request, $e->getMessage());
        }

        $data = $invoice->serialize(Invoice::SERIALIZE_DETAILS);
        return $response->withJson($data, StatusCode::STATUS_CREATED);
    }

    public function delete(Request $request, Response $response): ResponseInterface
    {
        $id = $request->getIntegerAttribute('id');

        $estimate = Estimate::withTrashed()->findOrFail($id);
        if ($estimate->is_used) {
            throw new HttpConflictException($request, "The estimate cannot be deleted because it is in use.");
        }

        // - Note: Les brouillons sont supprimés définitivement directement.
        $isDeleted = $estimate->trashed() || $estimate->is_draft
            ? $estimate->forceDelete()
            : $estimate->delete();

        if (!$isDeleted) {
            throw new \RuntimeException("An unknown error occurred while deleting the estimate.");
        }

        return $response->withStatus(StatusCode::STATUS_NO_CONTENT);
    }

    public function restore(Request $request, Response $response): ResponseInterface
    {
        $id = $request->getIntegerAttribute('id');

        $estimate = Estimate::query()
            ->onlyTrashed()
            ->findOrFail($id);

        if (!$estimate->restore()) {
            throw new \RuntimeException(sprintf("Unable to restore the estimate %d.", $id));
        }

        $data = $estimate->serialize(Estimate::SERIALIZE_DETAILS);
        return $response->withJson($data, StatusCode::STATUS_OK);
    }
}
