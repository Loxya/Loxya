<?php
declare(strict_types=1);

namespace Loxya\Controllers;

use Fig\Http\Message\StatusCodeInterface as StatusCode;
use Loxya\Config\Config;
use Loxya\Config\Enums\BillingMode;
use Loxya\Errors\Exception\HttpConflictException;
use Loxya\Http\Request;
use Loxya\Models\DegressiveRate;
use Psr\Http\Message\ResponseInterface;
use Slim\Exception\HttpBadRequestException;
use Slim\Exception\HttpNotFoundException;
use Slim\Http\Response;

final class DegressiveRateController extends BaseController
{
    public function getAll(Request $request, Response $response): ResponseInterface
    {
        if (Config::get('billingMode') === BillingMode::NONE) {
            throw new HttpNotFoundException($request);
        }

        $countries = DegressiveRate::orderBy('id', 'asc')->get();
        return $response->withJson($countries, StatusCode::STATUS_OK);
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

        $degressiveRate = DegressiveRate::new($postData);

        return $response->withJson($degressiveRate, StatusCode::STATUS_CREATED);
    }

    public function update(Request $request, Response $response): ResponseInterface
    {
        if (Config::get('billingMode') === BillingMode::NONE) {
            throw new HttpNotFoundException($request);
        }

        $id = $request->getIntegerAttribute('id');
        $degressiveRate = DegressiveRate::findOrFail($id);

        $postData = (array) $request->getParsedBody();
        if (empty($postData)) {
            throw new HttpBadRequestException($request, "No data was provided.");
        }

        $degressiveRate->edit($postData);

        return $response->withJson($degressiveRate, StatusCode::STATUS_OK);
    }

    public function delete(Request $request, Response $response): ResponseInterface
    {
        if (Config::get('billingMode') === BillingMode::NONE) {
            throw new HttpNotFoundException($request);
        }

        $id = $request->getIntegerAttribute('id');

        $degressiveRate = DegressiveRate::findOrFail($id);
        if ($degressiveRate->is_used || $degressiveRate->is_default) {
            throw new HttpConflictException($request, "The degressive rate cannot be deleted because it is in use.");
        }

        if (!$degressiveRate->delete()) {
            throw new \RuntimeException("An unknown error occurred while deleting the degressive rate.");
        }

        return $response->withStatus(StatusCode::STATUS_NO_CONTENT);
    }
}
