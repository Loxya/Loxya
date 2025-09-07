<?php
declare(strict_types=1);

namespace Loxya\Services\Auth;

use Loxya\Config\Config;
use Loxya\Http\Request;
use Loxya\Models\User;
use Loxya\Services\Auth\Contracts\AuthenticatorInterface;

final class Test implements AuthenticatorInterface
{
    public static ?User $user = null;

    public function __construct()
    {
        if (Config::getEnv() !== 'test') {
            throw new \RuntimeException('Test authenticator must not be used outside test environment.');
        }
    }

    public function isEnabled(): bool
    {
        return Config::getEnv() === 'test' && defined('TEST');
    }

    public function getUser(Request $request): ?User
    {
        return static::$user?->refresh();
    }

    public function clearPersistentData(): void
    {
        // - Rien à faire.
    }
}
