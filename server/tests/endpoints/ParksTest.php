<?php
declare(strict_types=1);

namespace Loxya\Tests;

use Fig\Http\Message\StatusCodeInterface as StatusCode;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Loxya\Models\Park;
use Loxya\Support\Arr;

final class ParksTest extends ApiTestCase
{
    public static function data(?int $id = null, string $format = Park::SERIALIZE_DEFAULT)
    {
        $parks = new Collection([
            [
                'id' => 1,
                'name' => 'default',
                'street' => 'Hangar 951',
                'postal_code' => '01234',
                'locality' => 'Secretville',
                'country_id' => 1,
                'opening_hours' => "Du lundi au vendredi, de 09:00 à 19:00.",
                'note' => null,
                'total_items' => 7,
                'total_stock_quantity' => 88,
                'has_ongoing_booking' => false,
            ],
            [
                'id' => 2,
                'name' => 'spare',
                'street' => null,
                'postal_code' => null,
                'locality' => null,
                'country_id' => null,
                'opening_hours' => null,
                'note' => "Les bidouilles de fond de tiroir",
                'total_items' => 1,
                'total_stock_quantity' => 2,
                'has_ongoing_booking' => false,
            ],
        ]);

        $parks = match ($format) {
            Park::SERIALIZE_SUMMARY => $parks->map(static fn ($park) => (
                Arr::only($park, ['id', 'name'])
            )),
            Park::SERIALIZE_DEFAULT => $parks->map(static fn ($park) => (
                Arr::except($park, [
                    'has_ongoing_booking',
                ])
            )),
            Park::SERIALIZE_DETAILS => $parks,
            default => throw new \InvalidArgumentException(sprintf("Unknown format \"%s\"", $format)),
        };

        return static::dataFactory($id, $parks->all());
    }

    public function testGetAll(): void
    {
        $this->client->get('/api/parks');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponsePaginatedData(2, [
            self::data(1),
            self::data(2),
        ]);

        $this->client->get('/api/parks?deleted=1');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponsePaginatedData(0);
    }

    public function testGetList(): void
    {
        $this->client->get('/api/parks/list');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseData(self::data(null, Park::SERIALIZE_SUMMARY));
    }

    public function testGetOne(): void
    {
        static::setNow(Carbon::create(2022, 10, 22, 18, 42, 36));

        // - Avec un enregistrement inexistant.
        $this->client->get('/api/parks/999');
        $this->assertStatusCode(StatusCode::STATUS_NOT_FOUND);

        // - Test valide.
        $this->client->get('/api/parks/1');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseData(self::data(1, Park::SERIALIZE_DETAILS));
    }

    public function testGetOneMaterials(): void
    {
        $this->client->get('/api/parks/2/materials');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseData([
            MaterialsTest::data(7),
        ]);
    }

    public function testGetOneTotalAmount(): void
    {
        // - Avec un enregistrement inexistant.
        $this->client->get('/api/parks/999/total-amount');
        $this->assertStatusCode(StatusCode::STATUS_NOT_FOUND);

        // - Test valide.
        $this->client->get('/api/parks/1/total-amount');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseData('119480.80');
    }

    public function testCreate(): void
    {
        $this->client->post('/api/parks', [
            'name' => 'Un nouveau parc',
        ]);
        $this->assertStatusCode(StatusCode::STATUS_CREATED);
        $this->assertResponseData([
            'id' => 3,
            'name' => 'Un nouveau parc',
            'street' => null,
            'postal_code' => null,
            'locality' => null,
            'country_id' => null,
            'opening_hours' => null,
            'note' => null,
            'total_items' => 0,
            'total_stock_quantity' => 0,
            'has_ongoing_booking' => false,
        ]);
    }

    public function testUpdate(): void
    {
        static::setNow(Carbon::create(2022, 10, 22, 18, 42, 36));

        $this->client->put('/api/parks/1', [
            'name' => 'Mon parc',
        ]);
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseData(array_replace(
            self::data(1, Park::SERIALIZE_DETAILS),
            [
                // - Uniquement le nom a été modifié.
                'name' => 'Mon parc',
            ],
        ));
    }
}
