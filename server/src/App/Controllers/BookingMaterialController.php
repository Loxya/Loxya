<?php
declare(strict_types=1);

namespace Loxya\Controllers;

use Fig\Http\Message\StatusCodeInterface as StatusCode;
use Illuminate\Support\Collection;
use Loxya\Config\Config;
use Loxya\Errors\Exception\HttpUnprocessableEntityException;
use Loxya\Http\Request;
use Loxya\Models\Event;
use Loxya\Models\EventMaterial;
use Loxya\Models\Material;
use Loxya\Support\Arr;
use Psr\Http\Message\ResponseInterface;
use Slim\Exception\HttpBadRequestException;
use Slim\Exception\HttpNotFoundException;
use Slim\Http\Response;

final class BookingMaterialController extends BaseController
{
    public const BOOKING_TYPES = [
        Event::TYPE => Event::class,
    ];

    public function resynchronize(Request $request, Response $response): ResponseInterface
    {
        $id = $request->getIntegerAttribute('id');
        $entity = $request->getAttribute('entity');
        $materialId = $request->getAttribute('materialId');
        if (!array_key_exists($entity, self::BOOKING_TYPES)) {
            throw new HttpNotFoundException($request, "Booking type (entity) not recognized.");
        }

        $material = Material::find($materialId);
        if (!$material) {
            throw new HttpUnprocessableEntityException(
                $request,
                "Cannot resynchronize an inexistant or deleted material.",
            );
        }

        /** @var Event $booking */
        $booking = self::BOOKING_TYPES[$entity]::findOrFail($id);

        if (!$booking->is_editable) {
            throw new HttpUnprocessableEntityException($request, "This booking is no longer editable.");
        }

        /** @var Collection<int, EventMaterial> $bookingMaterials */
        $bookingMaterials = $booking->materials->toBase()->keyBy('material_id');

        /** @var EventMaterial|null $bookingMaterial */
        $bookingMaterial = $bookingMaterials->get($materialId);
        if ($bookingMaterial === null) {
            throw new HttpNotFoundException($request, "Booking does not contain the specified material.");
        }

        $selection = array_unique((array) $request->getParsedBody());
        $validFields = $booking->is_billable
            ? ['name', 'reference', 'degressive_rate', 'unit_price', 'taxes']
            : ['name', 'reference'];

        if (
            empty($selection) ||
            !Arr::isList($selection) ||
            !empty(array_diff($selection, $validFields))
        ) {
            throw new HttpBadRequestException($request, "The list of fields to be resynchronized is invalid.");
        }

        $currencyChanged = $booking->currency !== Config::get('currency');
        if ($currencyChanged && in_array('unit_price', $selection, true)) {
            throw new HttpBadRequestException(
                $request,
                "Resynchronization of the unit price is not possible when " .
                "the booking currency differ from the global one.",
            );
        }
        if ($currencyChanged && in_array('taxes', $selection, true)) {
            $canResyncTaxes = (new Collection($material->tax?->asFlatArray() ?? []))
                ->every('is_rate', true);

            if (!$canResyncTaxes) {
                throw new HttpBadRequestException(
                    $request,
                    "Resynchronization of taxes is not possible when " .
                    "the booking currency differ from the global one.",
                );
            }
        }

        $attributes = [
            'name' => 'name',
            'reference' => 'reference',
            'unit_price' => 'rental_price',
        ];
        foreach ($attributes as $attribute => $materialAttribute) {
            if (in_array($attribute, $selection, true)) {
                $bookingMaterial->setAttribute(
                    $attribute,
                    $material->getAttribute($materialAttribute),
                );
            }
        }

        if (in_array('degressive_rate', $selection, true)) {
            $durationDays = $booking->operation_period->asDays();
            $degressiveRate = $material->degressive_rate?->computeForDays($durationDays)
                // - Pas de dégressivité.
                ?? $durationDays;

            $bookingMaterial->degressive_rate = $degressiveRate;
        }

        if (in_array('taxes', $selection, true)) {
            $bookingMaterial->taxes = $material->tax?->asFlatArray();
        }

        $bookingMaterial->save();

        return $response->withJson($bookingMaterial, StatusCode::STATUS_OK);
    }
}
