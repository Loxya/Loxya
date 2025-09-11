<?php
declare(strict_types=1);

namespace Loxya\Tests;

use Illuminate\Support\Carbon;
use Loxya\Models\Event;
use Loxya\Models\EventMaterial;

final class EventMaterialTest extends TestCase
{
    public function testQuantityDeparted(): void
    {
        static::setNow(Carbon::create(2018, 12, 17, 12, 40, 0));

        // - Quantité: 15 / Quantité partie: 10
        /** @var EventMaterial $eventMaterial */
        $eventMaterial = tap(EventMaterial::findOrFail(6), static function ($eventMaterial) {
            $eventMaterial->quantity = 15;
            $eventMaterial->save();
            $eventMaterial->refresh();
        });

        // - Vu que l'inventaire de départ est fait, le matériel doit retourner 15
        //   en quantité partie, même si en vérité la colonne indique 10.
        $this->assertSame(15, $eventMaterial->quantity_departed);

        // - On remet l'inventaire de départ de l'événement en "non effectué".
        $event = Event::findOrFail(3);
        $event->is_departure_inventory_done = false;
        $event->departure_inventory_author_id = null;
        $event->departure_inventory_datetime = null;
        $event->save();
        $eventMaterial->refresh();

        // - Vu que l'inventaire de départ n'est maintenant plus marqué comme terminé,
        //   la vraie quantité (= celle en base de données), doit être retournée.
        $this->assertSame(10, $eventMaterial->quantity_departed);
    }
}
