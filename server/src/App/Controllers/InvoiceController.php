<?php
declare(strict_types=1);

namespace Loxya\Controllers;

use Fig\Http\Message\StatusCodeInterface as StatusCode;
use Illuminate\Database\Eloquent\Builder;
use Loxya\Config\Config;
use Loxya\Config\Enums\BillingMode;
use Loxya\Errors\Exception\HttpUnprocessableEntityException;
use Loxya\Http\Request;
use Loxya\Models\Beneficiary;
use Loxya\Models\Enums\BillingFormat;
use Loxya\Models\Enums\InvoiceStatus;
use Loxya\Models\Invoice;
use Loxya\Services\Auth;
use Loxya\Support\Arr;
use Loxya\Support\Validation\ValidationsException;
use Psr\Http\Message\ResponseInterface;
use Slim\Exception\HttpBadRequestException;
use Slim\Exception\HttpNotFoundException;
use Slim\Http\Response;

final class InvoiceController extends BaseController
{
    public function getAll(Request $request, Response $response): ResponseInterface
    {
        if (Config::get('billingMode') === BillingMode::NONE) {
            throw new HttpNotFoundException($request);
        }

        $search = $request->getSearchArrayQueryParam('search');
        $limit = $request->getIntegerQueryParam('limit');
        $orderBy = $request->getOrderByQueryParams('orderBy', 'ascending', Invoice::class);

        // - Filtres
        $date = $request->getComplexDateQueryParam('date', ['=', '<', '>']);
        $dueDate = $request->getComplexDateQueryParam('dueDate', ['=', '<', '>']);
        $amount = $request->getComplexNumericQueryParam('amount', ['=', '<', '>']);
        $statuses = $request->getEnumArrayQueryParam('status', InvoiceStatus::class);

        $query = Invoice::query()
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
                $subQuery->where(static fn (Builder $subSubQuery) => (
                    $subSubQuery
                        ->where(static fn (Builder $subSubSubQuery) => (
                            $subSubSubQuery
                                ->where('is_credit_note', false)
                                ->where('total_without_taxes', $amount['operator'], $amount['value'])
                        ))
                        ->orWhere(static fn (Builder $subSubSubQuery) => (
                            $subSubSubQuery
                                ->where('is_credit_note', true)
                                ->where(
                                    'total_without_taxes',
                                    match ($amount['operator']) {
                                        '<' => '>',
                                        '>' => '<',
                                        default => '=',
                                    },
                                    -$amount['value'],
                                )
                        ))
                ))
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
        $invoice = Invoice::findOrFail($id);

        $data = $invoice->serialize(Invoice::SERIALIZE_DETAILS);
        return $response->withJson($data, StatusCode::STATUS_OK);
    }

    public function getOnePdf(Request $request, Response $response): ResponseInterface
    {
        $id = $request->getIntegerAttribute('id');
        $invoice = Invoice::findOrFail($id);

        return $invoice->toPdf()->asResponse($response);
    }

    public function getOneUbl(Request $request, Response $response): ResponseInterface
    {
        $id = $request->getIntegerAttribute('id');
        $invoice = Invoice::findOrFail($id);

        // - Si l'UBL n'est pas applicable pour cette facture, on renvoie une 404.
        if (!$invoice->supportsUbl()) {
            throw new HttpNotFoundException($request);
        }

        return $invoice->toUbl()->asResponse($response);
    }

    public function addPayment(Request $request, Response $response): ResponseInterface
    {
        $id = $request->getIntegerAttribute('id');
        $invoice = Invoice::findOrFail($id);

        // - Les factures "legacy" ne gèrent pas les paiements.
        if ($invoice->format < BillingFormat::V3->value) {
            throw new HttpUnprocessableEntityException($request, (
                "Payments are not supported for legacy invoices."
            ));
        }

        // - Les factures annulées n'acceptent plus de paiements.
        if ($invoice->is_cancelled) {
            throw new HttpUnprocessableEntityException($request, (
                "Payments cannot be recorded for a cancelled invoice."
            ));
        }

        $postData = (array) $request->getParsedBody();
        if (empty($postData)) {
            throw new HttpBadRequestException($request, "No data was provided.");
        }

        try {
            $payment = $invoice->addPayment($postData);
        } catch (\InvalidArgumentException $e) {
            throw new HttpBadRequestException($request, $e->getMessage());
        } catch (\DomainException $e) {
            throw new HttpUnprocessableEntityException($request, $e->getMessage());
        }

        return $response->withJson($payment, StatusCode::STATUS_CREATED);
    }

    public function updateStatus(Request $request, Response $response): ResponseInterface
    {
        $id = $request->getIntegerAttribute('id');
        $invoice = Invoice::findOrFail($id);

        $newStatus = $request->getParsedBodyParam('status');
        if ($newStatus === null) {
            throw new HttpBadRequestException($request, "Missing required status.");
        }

        // - Les statuts dérivés ne sont pas modifiables manuellement, tout
        //   comme le statut "brouillon" qui ne peut être assigné que via
        //   la création initiale.
        $assignableStatuses = [
            InvoiceStatus::PENDING->value,
            InvoiceStatus::SENT->value,
        ];
        if (!in_array($newStatus, $assignableStatuses, true)) {
            throw new HttpBadRequestException($request, "This status cannot be set manually.");
        }

        $invoice->status = $newStatus;
        $invoice->save();

        $data = $invoice->refresh()->serialize(Invoice::SERIALIZE_DETAILS);
        return $response->withJson($data, StatusCode::STATUS_OK);
    }

    public function finalize(Request $request, Response $response): ResponseInterface
    {
        $id = $request->getIntegerAttribute('id');
        $invoice = Invoice::findOrFail($id);

        if (!$invoice->is_draft) {
            throw new HttpUnprocessableEntityException($request, (
                "Only draft invoices can be finalized."
            ));
        }

        try {
            $invoice = $invoice->finalize();
        } catch (\DomainException $e) {
            throw new HttpUnprocessableEntityException($request, $e->getMessage());
        }

        $data = $invoice->serialize(Invoice::SERIALIZE_DETAILS);
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
            $invoice = Invoice::createFromScratch($buyer, $postData, Auth::user());
        } catch (\InvalidArgumentException) {
            throw new HttpBadRequestException($request);
        }

        $payload = $invoice->serialize(Invoice::SERIALIZE_DETAILS);
        return $response->withJson($payload, StatusCode::STATUS_CREATED);
    }

    public function createCreditNote(Request $request, Response $response): ResponseInterface
    {
        $id = $request->getIntegerAttribute('id');
        $invoice = Invoice::findOrFail($id);

        try {
            $creditNote = Invoice::createCreditNote($invoice, Auth::user());
        } catch (\InvalidArgumentException $e) {
            throw new HttpUnprocessableEntityException($request, $e->getMessage());
        }

        $data = $creditNote->serialize(Invoice::SERIALIZE_DETAILS);
        return $response->withJson($data, StatusCode::STATUS_CREATED);
    }

    public function delete(Request $request, Response $response): ResponseInterface
    {
        $id = $request->getIntegerAttribute('id');
        $invoice = Invoice::findOrFail($id);

        // - Seuls les brouillons peuvent être supprimés.
        if (!$invoice->is_draft) {
            throw new HttpUnprocessableEntityException($request, "Only draft invoices can be deleted.");
        }

        if (!$invoice->forceDelete()) {
            throw new \RuntimeException("An unknown error occurred while deleting the invoice.");
        }

        return $response->withStatus(StatusCode::STATUS_NO_CONTENT);
    }
}
