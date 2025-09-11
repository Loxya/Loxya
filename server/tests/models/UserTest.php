<?php
declare(strict_types=1);

namespace Loxya\Tests;

use Illuminate\Database\Eloquent\ModelNotFoundException;
use Loxya\Errors\Exception\ValidationException;
use Loxya\Models\Enums\Group;
use Loxya\Models\User;
use Loxya\Support\Hash;

final class UserTest extends TestCase
{
    public function testFromLogin(): void
    {
        // - Avec un un couple d'identifiants inexistants.
        $this->assertThrow(ModelNotFoundException::class, static fn () => (
            User::fromLogin('foo', 'bar')
        ));

        // - Retourne l'utilisateur #1 et sa personne associée en utilisant l'e-mail
        try {
            $resultUser = User::fromLogin('tester@loxya.com', 'testing-pw');
            $this->assertEquals(1, $resultUser->id);
        } catch (ModelNotFoundException) {
            $this->fail('The user has not been correctly retrieved.');
        }

        // - Retourne l'utilisateur #1 et sa personne associée en utilisant le pseudo
        try {
            $resultUser = User::fromLogin('test1', 'testing-pw');
            $this->assertEquals(1, $resultUser->id);
        } catch (ModelNotFoundException) {
            $this->fail('The user has not been correctly retrieved.');
        }
    }

    public function testCreateWithoutData(): void
    {
        $this->expectException(ValidationException::class);
        User::new([]);
    }

    public function testCreateBadData(): void
    {
        $user = new User(['pseudo' => 'invalid']);
        $expectedErrors = [
            'email' => 'Ce champ est obligatoire.',
            'group' => 'Ce champ est invalide.',
            'password' => 'Ce champ est obligatoire.',
        ];
        $this->assertFalse($user->isValid());
        $this->assertSame($expectedErrors, $user->validationErrors());

        // - Avec un mot de passe hashé par l'utilisateur.
        $user = new User([
            'pseudo' => 'Pseudo',
            'group' => Group::OPERATION,
            'email' => 'email@example.com',
            'password' => '$2y$12$X6gpH9HYq4.mQ3JHy9qWWeuAwTEsZdkpVnz9Qbpzi3nMpBnuIiiNO',
        ]);
        $expectedErrors = [
            'password' => "Ce champ est invalide.",
        ];
        $this->assertFalse($user->isValid());
        $this->assertSame($expectedErrors, $user->validationErrors());
    }

    public function testCreateWithoutPerson(): void
    {
        $this->expectException(ValidationException::class);
        User::new([
            'pseudo' => 'Owkay',
            'email' => 'owkay@test.org',
            'group' => Group::ADMINISTRATION,
            'password' => 'test-pw',
        ]);
    }

    public function testCreate(): void
    {
        $user = User::new([
            'pseudo' => 'testAdd',
            'email' => 'testadd@testing.org',
            'password' => 'test-add',
            'group' => Group::OPERATION,
            'person' => [
                'first_name' => 'Testing',
                'last_name' => 'Add',
                'reference' => 'test1',
            ],
        ]);
        $this->assertSame(6, $user->id);
        $this->assertSame('testAdd', $user->pseudo);
        $this->assertSame('testadd@testing.org', $user->email);
        $this->assertSame(Group::OPERATION, $user->group);
        $this->assertNotSame('test-add', $user->password);
        $this->assertTrue(Hash::isHashed($user->password));
        $this->assertTrue(Hash::check('test-add', $user->password));
        $this->assertSame(9, $user->person->id);
        $this->assertSame(6, $user->person->user_id);
        $this->assertSame('Testing', $user->person->first_name);
        $this->assertSame('Add', $user->person->last_name);
    }

    public function testEdit(): void
    {
        $user = User::findOrFail(1)->edit([
            'pseudo' => 'test-edit',
            'email' => 'test-edit@loxya.com',
        ]);
        $this->assertEquals('test-edit', $user->pseudo);

        // - Test update avec des données de "Person"
        $user = User::findOrFail(3)->edit([
            'pseudo' => 'testEdit',
            'person' => [
                'first_name' => 'Testing',
                'last_name' => 'Tester',
            ],
        ]);
        $this->assertEquals('testEdit', $user->pseudo);
        $this->assertEquals('Testing Tester', $user->person->full_name);
    }

    public function testEditPassword(): void
    {
        // - Si le mot de passe n'a pas changé, pas de soucis.
        $user = User::findOrFail(1);
        $originalPassword = $user->password;
        $this->assertTrue($user->isValid());

        // - On save pour tester que le mot de passe n'est pas double-hashé.
        $user->save();
        $user->refresh();
        $this->assertSame($originalPassword, $user->password);

        // - Si le mot de passe n'a pas changé, pas de soucis.
        $user = User::findOrFail(1)->fill(['password' => $originalPassword]);
        $this->assertTrue($user->isValid());

        // - On save pour tester que le mot de passe n'est pas double-hashé.
        $user->save();
        $user->refresh();
        $this->assertSame($originalPassword, $user->password);

        // - Les mots de passés déjà hashés (autre que l'actuel) ne devraient pas être acceptés.
        $user = User::findOrFail(1)->fill([
            'password' => '$2y$12$X6gpH9HYq4.mQ3JHy9qWWeuAwTEsZdkpVnz9Qbpzi3nMpBnuIiiNO',
        ]);
        $expectedErrors = [
            'password' => "Ce champ est invalide.",
        ];
        $this->assertFalse($user->isValid());
        $this->assertSame($expectedErrors, $user->validationErrors());

        // - Les mots de passés déjà hashés (autre que l'actuel) ne devraient pas être acceptés.
        $user = User::findOrFail(1)->fill(['password' => 'A password']);
        $this->assertTrue($user->isValid());
        $user->save();
        $user->refresh();
        $this->assertNotSame('A password', $user->password);
        $this->assertTrue(Hash::isHashed($user->password));
        $this->assertTrue(Hash::check('A password', $user->password));
    }
}
