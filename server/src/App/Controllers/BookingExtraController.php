<?php
declare(strict_types=1);

namespace Loxya\Controllers;

use Fig\Http\Message\StatusCodeInterface as StatusCode;
use Loxya\Config\Config;
use Loxya\Errors\Exception\HttpUnprocessableEntityException;
use Loxya\Http\Request;
use Loxya\Models\Event;
use Loxya\Models\EventExtra;
use Loxya\Support\Arr;
use Loxya\Support\Invoicing\TaxRegime;
use Psr\Http\Message\ResponseInterface;
use Slim\Exception\HttpBadRequestException;
use Slim\Exception\HttpNotFoundException;
use Slim\Http\Response;

final class BookingExtraController extends BaseController
{
    public const BOOKING_TYPES = [
        Event::TYPE => Event::class,
    ];

    public function resynchronize(Request $request, Response $response): ResponseInterface
    {
        $id = $request->getIntegerAttribute('id');
        $entity = $request->getAttribute('entity');
        $extraUuid = $request->getAttribute('extraUuid');
        if (!array_key_exists($entity, self::BOOKING_TYPES)) {
            throw new HttpNotFoundException($request, "Booking type (entity) not recognized.");
        }

        /** @var Event $booking */
        $booking = self::BOOKING_TYPES[$entity]::findOrFail($id);

        if (!$booking->is_editable || !$booking->is_billable) {
            throw new HttpUnprocessableEntityException($request, "This booking is no longer editable or not billable.");
        }

        /** @var EventExtra|null $bookingExtra */
        $bookingExtra = $booking->extras->firstWhere('uuid', $extraUuid);
        if ($bookingExtra === null) {
            throw new HttpNotFoundException($request, "Booking does not contain the specified extra.");
        }

        $selection = array_unique((array) $request->getParsedBody());
        $validFields = ['taxes'];

        if (
            empty($selection) ||
            !Arr::isList($selection) ||
            !empty(array_diff($selection, $validFields))
        ) {
            throw new HttpBadRequestException($request, "The list of fields to be resynchronized is invalid.");
        }

        if (in_array('taxes', $selection, true)) {
            $isVatExempted = Config::get('organization.isVatExempted', false);
            if ($isVatExempted) {
                throw new HttpUnprocessableEntityException($request, (
                    "The tax management is disabled, taxes cannot be resynchronized."
                ));
            }

            $isDefaultStandardTaxRegime = $bookingExtra->default_tax_regime === TaxRegime::STANDARD->value;
            $tax = $isDefaultStandardTaxRegime ? $bookingExtra->defaultTax : null;

            $bookingExtra->tax_regime = $bookingExtra->default_tax_regime;
            $bookingExtra->tax_exemption_code = $bookingExtra->default_tax_exemption_code;
            $bookingExtra->taxes = $tax?->asFlatArray();
            $bookingExtra->tax()->associate($tax);
        }

        $bookingExtra->save();

        return $response->withJson($bookingExtra, StatusCode::STATUS_OK);
    }
}
