<?php
declare(strict_types=1);

namespace Loxya\Tests;

use Loxya\Models\Person;

final class PersonTest extends TestCase
{
    public function testValidation(): void
    {
        // - Avec un nom / prénom alambiqué, mais valide.
        $data = [
            'first_name' => 'Joséphine 1ère',
            'last_name' => 'De la rue du four',
        ];
        $this->assertTrue((new Person($data))->isValid());

        // - Si le nom et/ou prénom contiennent des caractères invalides...
        $person = new Person([
            'first_name' => 'xav1er-7e$t',
            'last_name' => 'fo#32;reux',
        ]);
        $expectedErrors = [
            'first_name' => "Ce champ contient des caractères non autorisés.",
            'last_name' => "Ce champ contient des caractères non autorisés.",
        ];
        $this->assertFalse($person->isValid());
        $this->assertSame($expectedErrors, $person->validationErrors());
    }

    public function testSearch(): void
    {
        $results = Person::search('Jean')->get();
        $this->assertCount(2, $results);
        $this->assertEquals(
            ['Jean Fountain', 'Jean Technicien'],
            $results->pluck('full_name')->all(),
        );

        $results = Person::search('Fount')->get();
        $this->assertCount(1, $results);
        $this->assertEquals(['Jean Fountain'], $results->pluck('full_name')->all());

        $results = Person::search('Jean F')->get();
        $this->assertCount(1, $results);
        $this->assertEquals(['Jean Fountain'], $results->pluck('full_name')->all());

        $results = Person::search('Technicien Jean')->get();
        $this->assertCount(1, $results);
        $this->assertEquals(['Jean Technicien'], $results->pluck('full_name')->all());
    }

    public function testEditNormalizePhone(): void
    {
        // - Test 1 : Sans préfixe.
        $resultPerson = Person::findOrFail(1)->edit([
            'phone' => '06 25 25 21 25',
        ]);
        $this->assertEquals('0625252125', $resultPerson->phone);

        // - Test 2 : Avec préfixe `00`.
        $resultPerson = Person::findOrFail(1)->edit([
            'phone' => '00336 25 25 21 25',
        ]);
        $this->assertEquals('0033625252125', $resultPerson->phone);

        // - Test 2 : Avec préfixe `+`.
        $resultPerson = Person::findOrFail(1)->edit([
            'phone' => '+336 25 25 21 25',
        ]);
        $this->assertEquals('+33625252125', $resultPerson->phone);
    }

    public function testDeleteIfOrphan(): void
    {
        // - Test avec une personne liée à un bénéficiaire
        $person = Person::find(1);
        $person->deleteIfOrphan();
        $this->assertNotEmpty(Person::find(1));

        // - Test avec une personne liée à un technicien
        $person = Person::find(4);
        $person->deleteIfOrphan();
        $this->assertNotEmpty(Person::find(4));

        // - Test avec une personne liée à un utilisateur
        $person = Person::find(4);
        $person->deleteIfOrphan(false);
        $this->assertNotEmpty(Person::find(4));

        // - Test avec une personne "orpheline"
        $person = Person::create([
            'first_name' => "Marie",
            'last_name' => "Testing",
            'email' => "marie@testing.org",
        ]);
        $createdPersonId = $person->id;
        $person->deleteIfOrphan();
        $this->assertNull(Person::find($createdPersonId));
    }
}
