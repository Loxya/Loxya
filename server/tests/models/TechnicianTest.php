<?php
declare(strict_types=1);

namespace Loxya\Tests;

use Loxya\Errors\Exception\ValidationException;
use Loxya\Models\Event;
use Loxya\Models\Technician;

final class TechnicianTest extends TestCase
{
    public function testSearch(): void
    {
        // - Prénom
        $results = Technician::search('ro')->get();
        $this->assertCount(1, $results);
        $this->assertEquals(['Roger Rabbit'], $results->pluck('full_name')->all());

        // - Prénom nom
        $results = Technician::search('jean tec')->get();
        $this->assertCount(1, $results);
        $this->assertEquals(['Jean Technicien'], $results->pluck('full_name')->all());

        // - Nom Prénom
        $results = Technician::search('technicien jean')->get();
        $this->assertCount(1, $results);
        $this->assertEquals(['Jean Technicien'], $results->pluck('full_name')->all());

        // - Email
        $results = Technician::search('client@technicien.com')->get();
        $this->assertCount(1, $results);
        $this->assertEquals(['Jean Technicien'], $results->pluck('full_name')->all());

        // - Nickname
        $results = Technician::search('Riri')->get();
        $this->assertCount(1, $results);
        $this->assertEquals(['Roger Rabbit'], $results->pluck('full_name')->all());
    }

    public function testUnserialize(): void
    {
        $result = Technician::unserialize([
            'first_name' => 'Roger',
            'last_name' => 'Rabbit',
            'nickname' => 'Riri',
            'email' => 'tester2@loxya.com',
            'phone' => null,
            'street' => null,
            'postal_code' => null,
            'locality' => null,
            'country_id' => null,
            'user_id' => 2,
            'pseudo' => 'robbie',
            'password' => '123abc',
            'note' => null,
        ]);
        $expected = [
            'nickname' => 'Riri',
            'note' => null,
            'user_id' => 2,
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
                'pseudo' => 'robbie',
                'password' => '123abc',
            ],
        ];
        $this->assertEquals($expected, $result);

        // - Supprime les données liées à la personne et à l'utilisateur,
        //   qui ne sont pas attendues.
        $result = Technician::unserialize([
            'first_name' => 'Roger',
            'last_name' => 'Rabbit',
            'nickname' => 'Riri',
            'person_id' => 2,
            'person' => [
                'phone' => null,
                'street' => null,
                'postal_code' => null,
                'locality' => null,
                'country_id' => null,
            ],
            'user' => [
                'email' => 'tester2@loxya.com',
                'pseudo' => 'roger',
                'password' => 'test-mpd',
            ],
        ]);
        $expected = [
            'nickname' => 'Riri',
            'person' => [
                'first_name' => 'Roger',
                'last_name' => 'Rabbit',
            ],
        ];
        $this->assertEquals($expected, $result);

        // - Cas ou les données de la personne sont manquantes.
        $result = Technician::unserialize(['nickname' => 'Polo']);
        $this->assertEquals(['nickname' => 'Polo'], $result);

        // - Cas ou il n'y a pas de données.
        $this->assertEquals([], Technician::unserialize([]));
    }

    public function testCreateWithoutData(): void
    {
        $this->expectException(ValidationException::class);
        Technician::new([]);
    }

    public function testCreateBadData(): void
    {
        $this->expectException(ValidationException::class);
        Technician::new(['pseudo' => 'Sans email!']);
    }

    public function testCreateWithoutPerson(): void
    {
        $this->expectException(ValidationException::class);
        Technician::new(['nickname' => 'Gégé']);
    }

    public function testCreate(): void
    {
        $data = [
            'nickname' => 'Gégé',
            'note' => null,
            'person' => [
                'first_name' => 'José',
                'last_name' => 'Gatillon',
                'email' => 'test@other-tech.net',
                'phone' => null,
                'street' => null,
                'postal_code' => '74000',
                'locality' => 'Annecy',
                'country_id' => 2,
            ],
            'roles' => [1],
        ];

        $result = Technician::new($data);
        $this->assertEquals(3, $result->id);
        $this->assertEquals('Gégé', $result->nickname);
        $this->assertEquals(9, $result->person->id);
        $this->assertEquals('José', $result->person->first_name);
        $this->assertEquals('Gatillon', $result->person->last_name);
        $this->assertEquals('Annecy', $result->person->locality);
        $this->assertEquals('Suisse', $result->person->country->name);
        $this->assertEquals('Régisseur', $result->roles[0]->name);
    }

    public function testEdit(): void
    {
        $result = Technician::findOrFail(2)->edit([
            'roles' => [2, 3],
            'note' => "Ne pas déranger le week-end.",
        ]);
        $this->assertEquals("Ne pas déranger le week-end.", $result->note);
        $this->assertEquals("Ingénieur du son", $result->roles[0]->name);
        $this->assertEquals("Technicien plateau", $result->roles[1]->name);

        // - Test update avec des données de "Person"
        $data = ['person' => ['first_name' => 'Jessica']];
        $result = Technician::findOrFail(1)->edit($data);
        $this->assertEquals('Jessica Rabbit', $result->person->full_name);
    }

    public function testIsAssignedToEvent(): void
    {
        $technician1 = Technician::findOrFail(1);
        $this->assertTrue($technician1->isAssignedToEvent(Event::findOrFail(1)));
        $this->assertFalse($technician1->isAssignedToEvent(Event::findOrFail(2)));
        $this->assertFalse($technician1->isAssignedToEvent(Event::findOrFail(7)));

        $technician2 = Technician::findOrFail(2);
        $this->assertTrue($technician2->isAssignedToEvent(Event::findOrFail(1)));
        $this->assertFalse($technician2->isAssignedToEvent(Event::findOrFail(2)));
        $this->assertTrue($technician2->isAssignedToEvent(Event::findOrFail(7)));
    }
}
