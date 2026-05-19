<?php
declare(strict_types=1);

namespace Loxya\Tests;

use Brick\Math\BigDecimal as Decimal;
use Loxya\Models\Park;
use Loxya\Support\Validation\ValidationsException;

final class ParkTest extends TestCase
{
    public function testGetTotalItems(): void
    {
        $park = Park::findOrFail(1);
        $this->assertEquals(7, $park->total_items);
    }

    public function testGetTotalAmount(): void
    {
        $park = Park::findOrFail(1);

        $this->assertInstanceOf(Decimal::class, $park->total_amount);
        $this->assertSame('119480.80', (string) $park->total_amount);
    }

    public function testDelete(): void
    {
        // - Avec un parc non vide.
        $this->assertThrow(\LogicException::class, static function () {
            Park::findOrFail(1)->delete();
        });

        // - Avec un parc vide.
        $newPark = Park::create([
            'name' => 'Vide et éphémère',
            'country' => 'US',
        ]);
        $isDeleted = Park::findOrFail($newPark->id)->delete();
        $this->assertTrue($isDeleted);
        $this->assertNull(Park::find($newPark->id));
    }

    public function testCreateParkDuplicate(): void
    {
        $this->expectException(ValidationsException::class);
        Park::new(['name' => 'Défaut']);
    }
}
