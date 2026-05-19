<?php
declare(strict_types=1);

namespace Loxya\Tests\Observers;

use Carbon\CarbonImmutable;
use Illuminate\Support\Carbon;
use Loxya\Models\Enums\Group;
use Loxya\Models\User;
use Loxya\Services\Cache;
use Loxya\Tests\TestCase;

final class UserTest extends TestCase
{
    public function testCancelPasswordResetIfUserWithSameEmailCreated(): void
    {
        static::setNow(Carbon::create(2025, 05, 03, 12, 30, 0));

        /** @var Cache $cache */
        $cache = container('cache');

        $setCodeCache = static function (string $email, string|null $code) use ($cache) {
            $codeCacheKey = sprintf('password-reset.code.%s', md5($email));

            $now = CarbonImmutable::now();
            $codeCache = $cache
                ->getItem($codeCacheKey)
                ->set([
                    'email' => $email,
                    'code' => $code,
                    'attempts' => 0,
                    'createdAt' => $now->getTimestamp(),
                ])
                ->expiresAt($now->addMinutes(1));

            $cache->save($codeCache);

            return static fn () => $cache->getItem($codeCacheKey);
        };

        // - On met en cache le reset d'un utilisateur qui n'existe pas (fake donc).
        $cache = $setCodeCache('unknown@loxya.com', null);

        // - On crée un utilisateur avec cette même adresse e-mail.
        User::new([
            'pseudo' => 'unknown',
            'email' => 'unknown@loxya.com',
            'password' => '__password__',
            'group' => Group::READONLY_PLANNING_GENERAL,
            'person' => [
                'first_name' => 'Unknown',
                'last_name' => 'Unknown',
            ],
        ]);

        // - Le cache de reset doit avoir été supprimé.
        $this->assertFalse($cache()->isHit());
    }

    public function testCancelPasswordResetIfRelatedUserUpdated(): void
    {
        static::setNow(Carbon::create(2025, 05, 03, 12, 30, 0));

        /** @var Cache $cache */
        $cache = container('cache');

        $setCodeCache = static function (string $email, string|null $code) use ($cache) {
            $codeCacheKey = sprintf('password-reset.code.%s', md5($email));

            $now = CarbonImmutable::now();
            $codeCache = $cache
                ->getItem($codeCacheKey)
                ->set([
                    'email' => $email,
                    'code' => $code,
                    'attempts' => 0,
                    'createdAt' => $now->getTimestamp(),
                ])
                ->expiresAt($now->addMinutes(1));

            $cache->save($codeCache);

            return static fn () => $cache->getItem($codeCacheKey);
        };

        // - On met en cache le reset d'un utilisateur qui n'existe pas (fake donc).
        $cache1 = $setCodeCache('unknown@loxya.com', null);

        // - On met aussi en cache le reset de l'utilisateur #2.
        $cache2 = $setCodeCache('tester2@loxya.com', '123456');

        // - On met à jour un utilisateur existant avec la même adresse e-mail.
        User::findOrFail(2)->update(['email' => 'unknown@loxya.com']);

        // - Le cache de reset fake doit avoir été supprimé.
        $this->assertFalse($cache1()->isHit());
        $this->assertFalse($cache2()->isHit());

        //
        // - Test avec changement de groupe vers `administration`
        //

        // - On met aussi en cache le reset de l'utilisateur #3.
        $cache3 = $setCodeCache('alex.dupont@loxya.com', '123456');

        $user = User::findOrFail(3);

        // - On met à jour une donnée sans impact sur le reset.
        $user->update(['language' => 'en']);

        // - Le cache doit toujours être présent.
        $this->assertTrue($cache3()->isHit());

        // - On change le groupe vers `administration`.
        $user = tap($user, static function ($user) {
            $user->group = Group::ADMINISTRATION;
            $user->save();
        });

        // - Le cache doit avoir été supprimé.
        $this->assertFalse($cache3()->isHit());
    }

    public function testCancelPasswordResetIfRelatedUserDeleted(): void
    {
        static::setNow(Carbon::create(2025, 05, 03, 12, 30, 0));

        /** @var Cache $cache */
        $cache = container('cache');

        $setCodeCache = static function (string $email, string|null $code) use ($cache) {
            $codeCacheKey = sprintf('password-reset.code.%s', md5($email));

            $now = CarbonImmutable::now();
            $codeCache = $cache
                ->getItem($codeCacheKey)
                ->set([
                    'email' => $email,
                    'code' => $code,
                    'attempts' => 0,
                    'createdAt' => $now->getTimestamp(),
                ])
                ->expiresAt($now->addMinutes(1));

            $cache->save($codeCache);

            return static fn () => $cache->getItem($codeCacheKey);
        };

        // - On met en cache le reset de l'utilisateur #3.
        $cache = $setCodeCache('alex.dupont@loxya.com', '123456');

        // - On supprime l'utilisateur #3.
        User::findOrFail(3)->delete();

        // - Le cache doit avoir été supprimé.
        $this->assertFalse($cache()->isHit());
    }
}
