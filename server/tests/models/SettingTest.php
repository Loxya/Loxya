<?php
declare(strict_types=1);

namespace Loxya\Tests;

use Loxya\Models\Setting;
use Loxya\Support\Validation\ValidationsException;

final class SettingTest extends TestCase
{
    public function testGetList(): void
    {
        // - Si non spécifiée (ou `withSensitive = true`), les données sensibles doivent être présentes.
        $result = Setting::getList();
        $expected = [
            'eventSummary' => [
                'customText' => [
                    'title' => "Contrat",
                    'content' => "Un petit contrat de test.",
                ],
                'materialDisplayMode' => 'categories',
                'showDescriptions' => false,
                'showLegalNumbers' => true,
                'showReplacementPrices' => true,
                'showTags' => false,
                'showPictures' => false,
            ],
            'calendar' => [
                'event' => [
                    'showLocation' => true,
                    'showBorrower' => false,
                ],
                'public' => [
                    'enabled' => true,
                    'uuid' => 'dfe7cd82-52b9-4c9b-aaed-033df210f23b',
                    'displayedPeriod' => 'operation',
                ],
            ],
            'returnInventory' => [
                'mode' => 'start-empty',
            ],
            'billing' => [
                'defaultTax' => 1,
                'defaultDegressiveRate' => 1,
            ],
            'estimates' => [
                'showTotalReplacementPrice' => false,
                'showTotalisableProperties' => false,
                'showDescriptions' => false,
                'showReplacementPrices' => true,
                'specialMentions' => "Merci de nous contacter pour toute precision concernant ce devis.",
            ],
            'invoices' => [
                'showTotalReplacementPrice' => false,
                'showTotalisableProperties' => false,
                'showDescriptions' => false,
                'showReplacementPrices' => true,
                'specialMentions' => "Merci de préciser votre nom et prénom dans l'intitulé du virement.",
            ],
        ];
        $this->assertSameCanonicalize($expected, $result);

        // - Si `withSensitive = false`, les données sensibles ne sont pas retournées.
        $result = Setting::getList(false);
        $expected = [
            'eventSummary' => [
                'materialDisplayMode' => 'categories',
                'showDescriptions' => false,
                'showLegalNumbers' => true,
                'showReplacementPrices' => true,
                'showTags' => false,
                'showPictures' => false,
            ],
            'calendar' => [
                'event' => [
                    'showLocation' => true,
                    'showBorrower' => false,
                ],
                'public' => [
                    'enabled' => true,
                    'displayedPeriod' => 'operation',
                ],
            ],
            'returnInventory' => [
                'mode' => 'start-empty',
            ],
            'billing' => [
                'defaultTax' => 1,
                'defaultDegressiveRate' => 1,
            ],
            'estimates' => [
                'showTotalReplacementPrice' => false,
                'showTotalisableProperties' => false,
                'showDescriptions' => false,
                'showReplacementPrices' => true,
            ],
            'invoices' => [
                'showTotalReplacementPrice' => false,
                'showTotalisableProperties' => false,
                'showDescriptions' => false,
                'showReplacementPrices' => true,
            ],
        ];
        $this->assertSameCanonicalize($expected, $result);
    }

    public function testGetAll(): void
    {
        $result = Setting::get()->toArray();
        $expected = [
            [
                'key' => 'billing.defaultDegressiveRate',
                'value' => 1,
            ],
            [
                'key' => 'billing.defaultTax',
                'value' => 1,
            ],
            [
                'key' => 'calendar.event.showBorrower',
                'value' => false,
            ],
            [
                'key' => 'calendar.event.showLocation',
                'value' => true,
            ],
            [
                'key' => 'calendar.public.displayedPeriod',
                'value' => 'operation',
            ],
            [
                'key' => 'calendar.public.enabled',
                'value' => true,
            ],
            [
                'key' => 'calendar.public.uuid',
                'value' => 'dfe7cd82-52b9-4c9b-aaed-033df210f23b',
            ],
            [
                'key' => 'estimates.showDescriptions',
                'value' => false,
            ],
            [
                'key' => 'estimates.showReplacementPrices',
                'value' => true,
            ],
            [
                'key' => 'estimates.showTotalisableProperties',
                'value' => false,
            ],
            [
                'key' => 'estimates.showTotalReplacementPrice',
                'value' => false,
            ],
            [
                'key' => 'estimates.specialMentions',
                'value' => "Merci de nous contacter pour toute precision concernant ce devis.",
            ],
            [
                'key' => 'eventSummary.customText.content',
                'value' => "Un petit contrat de test.",
            ],
            [
                'key' => 'eventSummary.customText.title',
                'value' => "Contrat",
            ],
            [
                'key' => 'eventSummary.materialDisplayMode',
                'value' => 'categories',
            ],
            [
                'key' => 'eventSummary.showDescriptions',
                'value' => false,
            ],
            [
                'key' => 'eventSummary.showLegalNumbers',
                'value' => true,
            ],
            [
                'key' => 'eventSummary.showPictures',
                'value' => false,
            ],
            [
                'key' => 'eventSummary.showReplacementPrices',
                'value' => true,
            ],
            [
                'key' => 'eventSummary.showTags',
                'value' => false,
            ],
            [
                'key' => 'invoices.showDescriptions',
                'value' => false,
            ],
            [
                'key' => 'invoices.showReplacementPrices',
                'value' => true,
            ],
            [
                'key' => 'invoices.showTotalisableProperties',
                'value' => false,
            ],
            [
                'key' => 'invoices.showTotalReplacementPrice',
                'value' => false,
            ],
            [
                'key' => 'invoices.specialMentions',
                'value' => "Merci de préciser votre nom et prénom dans l'intitulé du virement.",
            ],
            [
                'key' => 'returnInventory.mode',
                'value' => 'start-empty',
            ],
        ];
        $this->assertSameCanonicalize($expected, $result);
    }

    public function testGetWithKey(): void
    {
        $result = Setting::getWithKey('eventSummary.materialDisplayMode');
        $this->assertEquals('categories', $result);

        $result = Setting::getWithKey('eventSummary.customText.title');
        $this->assertEquals("Contrat", $result);

        $result = Setting::getWithKey('eventSummary.customText');
        $expected = ['title' => 'Contrat', 'content' => 'Un petit contrat de test.'];
        $this->assertEquals($expected, $result);

        $result = Setting::getWithKey('eventSummary');
        $expected = [
            'customText' => [
                'title' => 'Contrat',
                'content' => 'Un petit contrat de test.',
            ],
            'materialDisplayMode' => 'categories',
            'showLegalNumbers' => true,
            'showReplacementPrices' => true,
            'showDescriptions' => false,
            'showTags' => false,
            'showPictures' => false,
        ];
        $this->assertEquals($expected, $result);

        $result = Setting::getWithKey('inexistant');
        $this->assertNull($result);
    }

    public function testBulkEditBadKey(): void
    {
        $this->expectException(ValidationsException::class);
        Setting::bulkEdit(['inexistant' => 'some-text']);
    }

    public function testBulkEditBadValue(): void
    {
        $this->expectException(ValidationsException::class);
        Setting::bulkEdit(['eventSummary.materialDisplayMode' => 'not-valid']);
    }

    public function testBulkEdit(): void
    {
        Setting::bulkEdit([
            'eventSummary.materialDisplayMode' => 'flat',
            'eventSummary.customText.title' => 'test',
            'eventSummary.customText.content' => null,
            'eventSummary.showLegalNumbers' => false,
            'eventSummary.showReplacementPrices' => false,
            'eventSummary.showDescriptions' => true,
            'eventSummary.showTags' => true,
            'eventSummary.showPictures' => true,
            'calendar.event.showLocation' => false,
            'calendar.event.showBorrower' => true,
            'calendar.public.displayedPeriod' => 'both',
            'billing.defaultDegressiveRate' => 3,
            'billing.defaultTax' => 2,
            'estimates.showReplacementPrices' => false,
            'estimates.specialMentions' => 'Test',
        ]);
        $expected = [
            'eventSummary' => [
                'customText' => [
                    'title' => 'test',
                    'content' => null,
                ],
                'materialDisplayMode' => 'flat',
                'showLegalNumbers' => false,
                'showReplacementPrices' => false,
                'showDescriptions' => true,
                'showTags' => true,
                'showPictures' => true,
            ],
            'calendar' => [
                'event' => [
                    'showLocation' => false,
                    'showBorrower' => true,
                ],
                'public' => [
                    'enabled' => true,
                    'uuid' => 'dfe7cd82-52b9-4c9b-aaed-033df210f23b',
                    'displayedPeriod' => 'both',
                ],
            ],
            'returnInventory' => [
                'mode' => 'start-empty',
            ],
            'billing' => [
                'defaultTax' => 2,
                'defaultDegressiveRate' => 3,
            ],
            'estimates' => [
                'showTotalReplacementPrice' => false,
                'showTotalisableProperties' => false,
                'showDescriptions' => false,
                'showReplacementPrices' => false,
                'specialMentions' => "Test",
            ],
            'invoices' => [
                'showTotalReplacementPrice' => false,
                'showTotalisableProperties' => false,
                'showDescriptions' => false,
                'showReplacementPrices' => true,
                'specialMentions' => "Merci de préciser votre nom et prénom dans l'intitulé du virement.",
            ],
        ];
        $this->assertEquals($expected, Setting::getList());
    }

    public function testReset(): void
    {
        // - Par défaut, le mode d'affichage du matériel est `sub-categories`.
        Setting::find('eventSummary.materialDisplayMode')->reset();
        $this->assertEquals('sub-categories', Setting::getWithKey('eventSummary.materialDisplayMode'));

        // - Par défaut, le calendrier public est désactivé.
        Setting::find('calendar.public.enabled')->reset();
        $this->assertEquals(false, Setting::getWithKey('calendar.public.enabled'));

        // - Par défaut, l'UUID de calendrier est un UUID aléatoire.
        Setting::find('calendar.public.uuid')->reset();
        $this->assertNotEquals('dfe7cd82-52b9-4c9b-aaed-033df210f23b', Setting::getWithKey('calendar.public.uuid'));

        // - Par défaut, le mode des inventaires de retour est 'start-empty'.
        Setting::find('returnInventory.mode')->reset();
        $this->assertEquals('start-empty', Setting::getWithKey('returnInventory.mode'));
    }

    public function testRemove(): void
    {
        $this->expectException(\LogicException::class);
        $this->expectExceptionMessage("Settings cannot be deleted.");
        Setting::findOrFail('calendar.public.enabled')->delete();
    }
}
