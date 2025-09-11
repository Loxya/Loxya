<?php
declare(strict_types=1);

namespace Loxya\Tests\Listeners;

use Carbon\CarbonImmutable;
use Illuminate\Support\Carbon;
use Loxya\Events\LoginEvent;
use Loxya\Models\User;
use Loxya\Services\Auth;
use Loxya\Services\Cache;
use Loxya\Tests\TestCase;

final class LoginTest extends TestCase
{
    public function testCancelPasswordResetIfUserLogIn(): void
    {
        static::setNow(Carbon::create(2025, 05, 03, 12, 30, 0));

        // - On reset l'état connecté.
        Auth\Test::$user = null;

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

        // - On déclenche l'événement d'identification de l'utilisateur #3.
        LoginEvent::dispatch(User::findOrFail(3));

        // - Le cache doit avoir été supprimé.
        $this->assertFalse($cache()->isHit());
    }
}
