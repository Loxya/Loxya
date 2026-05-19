<?php
declare(strict_types=1);

namespace Loxya\Tests;

use Loxya\Support\Arr;

final class ArrTest extends TestCase
{
    public function testGetOptional(): void
    {
        $array = [
            'keyOne' => 'valueOne',
            'keyTwo?' => 'valueTwo',
            'keyThree' => [
                'subKeyOne' => 'subValueOne',
                'subKeyTwo?' => 'subValueTwo',
            ],
            'keyFour?' => [
                'subKeyThree' => 'subValueThree',
                'subKeyFour?' => 'subValueFour',
            ],
        ];

        // - Clé existante sans '?', on retourne la valeur.
        $this->assertSame('valueOne', Arr::getOptional($array, 'keyOne'));

        // - Clé existante avec '?', on retourne la valeur.
        $this->assertSame('valueTwo', Arr::getOptional($array, 'keyTwo'));

        // - Sous-clé existante sans '?', on retourne la valeur.
        $this->assertSame('subValueOne', Arr::getOptional($array, 'keyThree.subKeyOne'));

        // - Sous-clé existante avec '?', on retourne la valeur.
        $this->assertSame('subValueTwo', Arr::getOptional($array, 'keyThree.subKeyTwo'));

        // - Sous-clé existante sans '?' dans le path, on retourne la valeur.
        $this->assertSame('subValueThree', Arr::getOptional($array, 'keyFour.subKeyThree'));

        // - Sous-clé existante avec '?' dans le path, on retourne la valeur.
        $this->assertSame('subValueFour', Arr::getOptional($array, 'keyFour.subKeyFour'));
    }
}
