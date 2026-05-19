<?php
declare(strict_types=1);

namespace Loxya\Tests\Observers;

use Illuminate\Support\Carbon;
use Loxya\Models\Estimate;
use Loxya\Models\Event;
use Loxya\Models\Invoice;
use Loxya\Support\Period;
use Loxya\Tests\TestCase;

final class EventTest extends TestCase
{
    public function testDeleteEventDetachBilling(): void
    {
        Event::findOrFail(1)->forceDelete();

        // - Si l'événement est supprimé, les factures et devis liés doivent être détachés mais
        //   pas supprimés (ceci est géré "manuellement" car ce sont des entités polymorphes).
        $invoice = Invoice::find(1);
        $this->assertNotNull($invoice);
        $this->assertNull($invoice->booking_id);

        $estimate = Estimate::find(1);
        $this->assertNotNull($estimate);
        $this->assertNull($estimate->booking_id);
    }

    public function testChangeDateResetDepartureInventory(): void
    {
        static::setNow(Carbon::create(2023, 11, 18, 21, 11, 22));

        $event = Event::findOrFail(1);
        $setEventDate = static function (Period $period) use (&$event) {
            $event->mobilization_period = $period;
            $event->operation_period = $period;
            $event->save(['validate' => false]);
            $event->refresh();
        };

        // - Si l'événement est mis à une autre date passée ...
        //   => Pas de changement (l'inventaire est laissé comme "effectué")
        $setEventDate(new Period('2020-11-17', '2020-11-18', true));
        $this->assertTrue($event->is_departure_inventory_done);
        foreach ($event->materials as $eventMaterial) {
            $this->assertNotNull($eventMaterial->quantity_departed);
        }

        // - Si l'événement est mis à une date future mais ou l'inventaire
        //   est déjà possible (- 30 jours avant le début de l'événement)...
        //   => Pas de changement (l'inventaire est laissé comme "effectué")
        $setEventDate(new Period('2023-12-18', '2023-12-19', true));
        $this->assertTrue($event->is_departure_inventory_done);
        foreach ($event->materials as $eventMaterial) {
            $this->assertNotNull($eventMaterial->quantity_departed);
        }

        // - Si l'événement est mis à une date future, pour laquelle l'inventaire
        //   ne serait pas possible sinon, on reset l'inventaire.
        $setEventDate(new Period('2023-12-20', '2023-12-21', true));
        $this->assertFalse($event->is_departure_inventory_done);
        foreach ($event->materials as $eventMaterial) {
            $this->assertNull($eventMaterial->quantity_departed);
            $this->assertNull($eventMaterial->departure_comment);
        }
    }

    public function testChangeDateResetReturnInventory(): void
    {
        static::setNow(Carbon::create(2023, 11, 18, 21, 11, 22));

        $event = Event::findOrFail(1);
        $setEventDate = static function (Period $period) use (&$event) {
            $event->mobilization_period = $period;
            $event->operation_period = $period;
            $event->save(['validate' => false]);
            $event->refresh();
        };

        // - Si l'événement est mis à une autre date passée ...
        //   => Pas de changement (l'inventaire est laissé comme "effectué")
        $setEventDate(new Period('2020-11-17', '2020-11-18', true));
        $this->assertTrue($event->is_return_inventory_done);
        foreach ($event->materials as $eventMaterial) {
            $this->assertNotNull($eventMaterial->quantity_returned);
            $this->assertNotNull($eventMaterial->quantity_returned_broken);
        }

        // - Si l'événement est mis à une date future pour laquelle l'inventaire
        //   ne serait pas possible sinon, on reset l'inventaire.
        $setEventDate(new Period('2023-11-20', '2023-11-21', true));
        $this->assertFalse($event->is_return_inventory_done);
        foreach ($event->materials as $eventMaterial) {
            $this->assertNull($eventMaterial->quantity_returned);
            $this->assertNull($eventMaterial->quantity_returned_broken);
        }
    }
}
