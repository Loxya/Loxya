<?php
declare(strict_types=1);

namespace Loxya\Tests;

use Fig\Http\Message\StatusCodeInterface as StatusCode;
use Illuminate\Support\Carbon;
use Loxya\Models\EventMaterial;
use Loxya\Models\Material;

final class BookingMaterialsTest extends ApiTestCase
{
    public function testResynchronize(): void
    {
        //
        // - Événements
        //

        static::setNow(Carbon::create(2023, 5, 25, 12, 0, 0));

        // - Test avec un événement inexistant.
        $this->client->put('/api/bookings/event/999/materials/1/resynchronize', ['name']);
        $this->assertStatusCode(StatusCode::STATUS_NOT_FOUND);

        // - Test avec un matériel inexistant.
        $this->client->put('/api/bookings/event/7/materials/999/resynchronize', ['name']);
        $this->assertStatusCode(StatusCode::STATUS_UNPROCESSABLE_ENTITY);
        $this->assertApiErrorMessage("Cannot resynchronize an inexistant or deleted material.");

        // - Test avec un matériel ne faisant pas partie de la liste de l'événement.
        $this->client->put('/api/bookings/event/7/materials/3/resynchronize', ['name']);
        $this->assertStatusCode(StatusCode::STATUS_NOT_FOUND);
        $this->assertApiErrorMessage("Booking does not contain the specified material.");

        // - Test avec un événement qui n'est pas modifiable.
        $this->client->put('/api/bookings/event/1/materials/1/resynchronize', ['name']);
        $this->assertStatusCode(StatusCode::STATUS_UNPROCESSABLE_ENTITY);
        $this->assertApiErrorMessage("This booking is no longer editable.");

        // - Test avec une sélection de champs à resynchroniser vide.
        $this->client->put('/api/bookings/event/7/materials/6/resynchronize', []);
        $this->assertStatusCode(StatusCode::STATUS_BAD_REQUEST);
        $this->assertApiErrorMessage("The list of fields to be resynchronized is invalid.");

        $savedEventMaterial = [
            'id' => 6,
            'name' => "Behringer X Air XR18",
            'reference' => 'XR18',
            'category_id' => 1,
            'quantity' => 2,
            'unit_price' => '49.99',
            'degressive_rate' => '3.25',
            'unit_price_period' => '162.47',
            'total_without_discount' => '324.94',
            'discount_rate' => '0.0000',
            'total_discount' => '0.00',
            'total_without_taxes' => '324.94',
            'taxes' => [
                [
                    'name' => 'T.V.A.',
                    'is_rate' => true,
                    'value' => '20.000',
                ],
            ],
            'unit_replacement_price' => '49.99',
            'total_replacement_price' => '99.98',
            'quantity_departed' => null,
            'quantity_returned' => 2,
            'quantity_returned_broken' => 1,
            'departure_comment' => null,
            'material' => array_merge(
                MaterialsTest::data(6, Material::SERIALIZE_WITH_CONTEXT_EXCERPT),
                [
                    'degressive_rate' => '3.25',
                    'rental_price_period' => '162.47',
                ],
            ),
        ];

        $changeEventMaterial = static function () {
            $eventMaterial = EventMaterial::find(14);
            $eventMaterial->name = "Changed name";
            $eventMaterial->reference = 'XR-188';
            $eventMaterial->unit_price = '52.00';
            $eventMaterial->degressive_rate = '2.5';
            $eventMaterial->taxes = [
                [
                    'name' => 'TVA',
                    'is_rate' => true,
                    'value' => '5.5',
                ],
            ];
            $eventMaterial->save();
        };

        // - Resynchronisation de tous les champs, sauf le nom.
        $changeEventMaterial();
        $this->client->put(
            '/api/bookings/event/7/materials/6/resynchronize',
            ['reference', 'unit_price', 'degressive_rate', 'taxes'],
        );
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseData(array_replace($savedEventMaterial, [
            'name' => "Changed name",
        ]));

        // - Resynchronisation du nom uniquement.
        $changeEventMaterial();
        $this->client->put('/api/bookings/event/7/materials/6/resynchronize', ['name']);
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseData(array_replace($savedEventMaterial, [
            'reference' => 'XR-188',
            'unit_price' => '52.00',
            'degressive_rate' => '2.50',
            'unit_price_period' => '130.00',
            'total_without_discount' => '260.00',
            'total_without_taxes' => '260.00',
            'taxes' => [
                [
                    'name' => 'TVA',
                    'is_rate' => true,
                    'value' => '5.500',
                ],
            ],
        ]));
    }
}
