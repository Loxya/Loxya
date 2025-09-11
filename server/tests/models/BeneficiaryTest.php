<?php
declare(strict_types=1);

namespace Loxya\Tests;

use Illuminate\Support\Carbon;
use Loxya\Errors\Exception\ValidationException;
use Loxya\Models\Beneficiary;
use Loxya\Models\Event;

final class BeneficiaryTest extends TestCase
{
    public function testSearch(): void
    {
        // - Prénom
        $results = Beneficiary::search('cli')->get();
        $this->assertCount(1, $results);
        $this->assertEquals(['Client Benef'], $results->pluck('full_name')->all());

        // - Prénom nom
        $results = Beneficiary::search('client ben')->get();
        $this->assertCount(1, $results);
        $this->assertEquals(['Client Benef'], $results->pluck('full_name')->all());

        // - Nom Prénom
        $results = Beneficiary::search('fountain jean')->get();
        $this->assertCount(1, $results);
        $this->assertEquals(['Jean Fountain'], $results->pluck('full_name')->all());

        // - Email
        $results = Beneficiary::search('@loxya.com')->get();
        $this->assertCount(2, $results);
        $this->assertEquals(['Jean Fountain', 'Roger Rabbit'], $results->pluck('full_name')->all());

        // - Référence
        $results = Beneficiary::search('0001')->get();
        $this->assertCount(1, $results);
        $this->assertEquals(['Jean Fountain'], $results->pluck('full_name')->all());

        // - Société
        $results = Beneficiary::search('Testing')->get();
        $this->assertCount(1, $results);
        $this->assertEquals(['Jean Fountain'], $results->pluck('full_name')->all());
    }

    public function testUnserialize(): void
    {
        $result = Beneficiary::unserialize([
            'first_name' => 'Roger',
            'last_name' => 'Rabbit',
            'reference' => '0004',
            'email' => 'tester2@loxya.com',
            'phone' => null,
            'street' => null,
            'postal_code' => null,
            'locality' => null,
            'country_id' => null,
            'note' => null,
        ]);
        $expected = [
            'reference' => '0004',
            'note' => null,
            'person' => [
                'first_name' => 'Roger',
                'last_name' => 'Rabbit',
                'email' => 'tester2@loxya.com',
                'phone' => null,
                'street' => null,
                'postal_code' => null,
                'locality' => null,
                'country_id' => null,
            ],
            'user' => [
                'email' => 'tester2@loxya.com',
            ],
        ];
        $this->assertEquals($expected, $result);

        // - Supprime les données liées à la personne qui ne sont pas attendues.
        $result = Beneficiary::unserialize([
            'first_name' => 'Roger',
            'last_name' => 'Rabbit',
            'reference' => '0004',
            'person_id' => 2,
            'person' => [
                'phone' => null,
                'street' => null,
                'postal_code' => null,
                'locality' => null,
                'country_id' => null,
            ],
        ]);
        $expected = [
            'reference' => '0004',
            'person' => [
                'first_name' => 'Roger',
                'last_name' => 'Rabbit',
            ],
        ];
        $this->assertEquals($expected, $result);

        // - Cas ou les données de la personne sont manquantes.
        $result = Beneficiary::unserialize(['reference' => '0010']);
        $this->assertEquals(['reference' => '0010'], $result);

        // - Cas ou il n'y a pas de données.
        $this->assertEquals([], Beneficiary::unserialize([]));
    }

    public function testCreateWithoutData(): void
    {
        $this->expectException(ValidationException::class);
        Beneficiary::new([]);
    }

    public function testBadData(): void
    {
        $this->expectException(ValidationException::class);
        Beneficiary::new(['pseudo' => 'Sans email!']);
    }

    public function testBadDataDuplicateRef(): void
    {
        $this->expectException(ValidationException::class);
        Beneficiary::new([
            'first_name' => 'Paul',
            'last_name' => 'Newtests',
            'email' => 'paul@tests.new',
            'reference' => '0005',
        ]);
    }

    public function testCreateWithoutPerson(): void
    {
        $this->expectException(ValidationException::class);
        Beneficiary::new(['reference' => '0009']);
    }

    public function testCreate(): void
    {
        static::setNow(Carbon::create(2023, 2, 10, 15, 00, 00));

        $data = [
            'note' => null,
            'person' => [
                'first_name' => 'José',
                'last_name' => 'Gatillon',
                'email' => 'test@other-benef.net',
                'phone' => null,
                'street' => null,
                'postal_code' => '74000',
                'locality' => 'Annecy',
                'country_id' => 2,
            ],
        ];

        $result = Beneficiary::new($data)
            ->append(['user'])
            ->toArray();
        $expected = [
            'id' => 5,
            'reference' => null,
            'person_id' => 9,
            'company_id' => null,
            'color' => null,
            'can_make_reservation' => 0,
            'note' => null,
            'created_at' => '2023-02-10 15:00:00',
            'updated_at' => '2023-02-10 15:00:00',
            'deleted_at' => null,
            'first_name' => 'José',
            'last_name' => 'Gatillon',
            'full_name' => 'José Gatillon',
            'email' => 'test@other-benef.net',
            'phone' => null,
            'street' => null,
            'postal_code' => '74000',
            'locality' => 'Annecy',
            'full_address' => '74000 Annecy',
            'country_id' => 2,
            'user_id' => null,
            'user' => null,
        ];
        $this->assertSameCanonicalize($expected, $result);
    }

    public function testEdit(): void
    {
        $result = Beneficiary::findOrFail(2)->edit(['note' => "Très bon client."]);
        $this->assertEquals("Très bon client.", $result->note);

        // - Test update avec des données de "Person"
        $data = ['person' => ['first_name' => 'Jessica']];
        $result = Beneficiary::findOrFail(2)->edit($data);
        $this->assertEquals('Jessica Rabbit', $result->person->full_name);
    }

    public function testIsAssignedToEvent(): void
    {
        $beneficiary1 = Beneficiary::findOrFail(1);
        $this->assertTrue($beneficiary1->isAssignedToEvent(Event::findOrFail(1)));
        $this->assertFalse($beneficiary1->isAssignedToEvent(Event::findOrFail(2)));
        $this->assertTrue($beneficiary1->isAssignedToEvent(Event::findOrFail(5)));

        $beneficiary3 = Beneficiary::findOrFail(3);
        $this->assertFalse($beneficiary3->isAssignedToEvent(Event::findOrFail(1)));
        $this->assertTrue($beneficiary3->isAssignedToEvent(Event::findOrFail(2)));
        $this->assertFalse($beneficiary3->isAssignedToEvent(Event::findOrFail(5)));
    }
}
