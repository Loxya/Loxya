<?php
declare(strict_types=1);

namespace Loxya\Tests;

use Loxya\Support\Str;

final class StrTest extends TestCase
{
    public function testHasProfanity(): void
    {
        $this->assertFalse(Str::hasProfanity('Test'));

        $this->assertTrue(Str::hasProfanity('fuck'));
        $this->assertTrue(Str::hasProfanity('FUCK'));
        $this->assertTrue(Str::hasProfanity('FUCKED'));

        $this->assertTrue(Str::hasProfanity('Connard'));
        $this->assertTrue(Str::hasProfanity('Conn4rd'));
        $this->assertTrue(Str::hasProfanity('C0nn4rd'));
        $this->assertTrue(Str::hasProfanity('C-o-n-n-a.r.d'));
    }

    public function testShortid(): void
    {
        // - Utilisation normale.
        $this->assertMatchesRegularExpression('/^[A-Z0-9]{6}$/', Str::shortid());

        // - Avec une factory (utile dans les tests unitaires).
        Str::createShortidUsing(static fn () => 'CUSTOM1');
        $this->assertSame('CUSTOM1', Str::shortid());
        $this->assertSame('CUSTOM1', Str::shortid());

        Str::createShortidNormally();
        $this->assertNotSame('CUSTOM1', Str::shortid());

        // - Avec le freezing (utile dans les tests unitaires).
        $freezedShortId = Str::freezeShortid();
        $this->assertSame($freezedShortId, Str::shortid());
        $this->assertSame($freezedShortId, Str::shortid());

        Str::createShortidNormally();
        $this->assertNotSame($freezedShortId, Str::shortid());

        // - Avec le freezing sous forme de callback (utile dans les tests unitaires).
        $freezedShortId = Str::freezeShortid(function ($freezedShortId) {
            $this->assertSame($freezedShortId, Str::shortid());
            $this->assertSame($freezedShortId, Str::shortid());
        });
        $this->assertNotSame($freezedShortId, Str::shortid());
    }

    public function testNumericCode(): void
    {
        // - Utilisation normale.
        $this->assertMatchesRegularExpression('/^[0-9]{6}$/', Str::numericCode());

        // - Avec une factory (utile dans les tests unitaires).
        Str::createNumericCodeUsing(static fn () => '123456');
        $this->assertSame('123456', Str::numericCode());
        $this->assertSame('123456', Str::numericCode());

        Str::createNumericCodeNormally();
        $this->assertNotSame('123456', Str::numericCode());

        // - Avec le freezing (utile dans les tests unitaires).
        $freezedCode = Str::freezeNumericCode();
        $this->assertSame($freezedCode, Str::freezeNumericCode());
        $this->assertSame($freezedCode, Str::freezeNumericCode());

        Str::createNumericCodeNormally();
        $this->assertNotSame($freezedCode, Str::numericCode());

        // - Avec le freezing sous forme de callback (utile dans les tests unitaires).
        $freezedCode = Str::freezeNumericCode(6, function ($freezedCode) {
            $this->assertSame($freezedCode, Str::numericCode());
            $this->assertSame($freezedCode, Str::numericCode());
        });
        $this->assertNotSame($freezedCode, Str::numericCode());

        // - Avec une séquence (utile dans les tests unitaires).
        Str::createNumericCodeUsingSequence(
            ['123456', '789023'],
            static fn () => '000000',
        );
        $this->assertSame('123456', Str::numericCode());
        $this->assertSame('789023', Str::numericCode());
        $this->assertSame('000000', Str::numericCode());
        $this->assertSame('000000', Str::numericCode());
    }
}
