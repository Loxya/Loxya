<?php
declare(strict_types=1);

namespace Loxya\Controllers;

use Fig\Http\Message\StatusCodeInterface as StatusCode;
use Illuminate\Database\Eloquent\Builder;
use Loxya\Config\Config;
use Loxya\Config\Enums\BillingMode;
use Loxya\Errors\Exception\HttpConflictException;
use Loxya\Http\Request;
use Loxya\Models\Tax;
use Psr\Http\Message\ResponseInterface;
use Slim\Exception\HttpBadRequestException;
use Slim\Exception\HttpNotFoundException;
use Slim\Http\Response;

final class TaxController extends BaseController
{
    // ------------------------------------------------------
    // -
    // -    Actions
    // -
    // ------------------------------------------------------

    public function getAll(Request $request, Response $response): ResponseInterface
    {
        $isVatExempted = Config::get('organization.isVatExempted', false);
        $isBillingActivated = Config::get('billingMode') !== BillingMode::NONE;
        if (!$isBillingActivated || $isVatExempted) {
            throw new HttpNotFoundException($request, "Tax management feature is disabled.");
        }

        $organizationCountry = Config::getOrganizationCountry();
        $hasSimpleVatSystem = $organizationCountry->hasSimpleVatSystem();
        $taxes = Tax::query()
            ->when(
                !$hasSimpleVatSystem,
                static fn (Builder $query) => (
                    $query->orderBy('name', 'asc')
                ),
            )
            ->orderBy('value', 'desc')
            ->orderBy('id', !$hasSimpleVatSystem ? 'asc' : 'desc')
            ->get();

        return $response->withJson($taxes, StatusCode::STATUS_OK);
    }

    public function create(Request $request, Response $response): ResponseInterface
    {
        // - Si la facturation est désactivée ou que l'organisation n'est
        //   pas assujettie, pas de gestion des taxes.
        $isVatExempted = Config::get('organization.isVatExempted', false);
        $isBillingActivated = Config::get('billingMode') !== BillingMode::NONE;
        if (!$isBillingActivated || $isVatExempted) {
            throw new HttpNotFoundException($request, "Tax management feature is disabled.");
        }

        $postData = (array) $request->getParsedBody();
        if (empty($postData)) {
            throw new HttpBadRequestException($request, "No data was provided.");
        }

        $tax = Tax::new($postData);

        return $response->withJson($tax, StatusCode::STATUS_CREATED);
    }

    public function update(Request $request, Response $response): ResponseInterface
    {
        // - Si la facturation est désactivée ou que l'organisation n'est
        //   pas assujettie, pas de gestion des taxes.
        $isVatExempted = Config::get('organization.isVatExempted', false);
        $isBillingActivated = Config::get('billingMode') !== BillingMode::NONE;
        if (!$isBillingActivated || $isVatExempted) {
            throw new HttpNotFoundException($request, "Tax management feature is disabled.");
        }

        $id = $request->getIntegerAttribute('id');
        $tax = Tax::findOrFail($id);

        $postData = (array) $request->getParsedBody();
        if (empty($postData)) {
            throw new HttpBadRequestException($request, "No data was provided.");
        }

        $tax->edit($postData);

        return $response->withJson($tax, StatusCode::STATUS_OK);
    }

    public function delete(Request $request, Response $response): ResponseInterface
    {
        // - Si la facturation est désactivée ou que l'organisation n'est
        //   pas assujettie, pas de gestion des taxes.
        $isVatExempted = Config::get('organization.isVatExempted', false);
        $isBillingActivated = Config::get('billingMode') !== BillingMode::NONE;
        if (!$isBillingActivated || $isVatExempted) {
            throw new HttpNotFoundException($request, "Tax management feature is disabled.");
        }

        $id = $request->getIntegerAttribute('id');

        $tax = Tax::findOrFail($id);
        if ($tax->is_used || $tax->is_default) {
            throw new HttpConflictException($request, "The tax cannot be deleted because it is in use.");
        }

        if (!$tax->delete()) {
            throw new \RuntimeException("An unknown error occurred while deleting the tax.");
        }

        return $response->withStatus(StatusCode::STATUS_NO_CONTENT);
    }
}
