<?php
declare(strict_types=1);

namespace Loxya\Tests;

use Fig\Http\Message\StatusCodeInterface as StatusCode;

final class SettingsTest extends ApiTestCase
{
    public function testGetAll(): void
    {
        $this->client->get('/api/settings');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseData([
            'general' => [
                'openingHours' => [
                    ['weekday' => 0, 'start_time' => '09:00:00', 'end_time' => '18:00:00'],
                    ['weekday' => 1, 'start_time' => '09:00:00', 'end_time' => '18:00:00'],
                    ['weekday' => 3, 'start_time' => '09:00:00', 'end_time' => '12:00:00'],
                    ['weekday' => 3, 'start_time' => '14:00:00', 'end_time' => '18:00:00'],
                    ['weekday' => 4, 'start_time' => '09:00:00', 'end_time' => '24:00:00'],
                    ['weekday' => 5, 'start_time' => '09:00:00', 'end_time' => '18:00:00'],
                    ['weekday' => 6, 'start_time' => '09:45:00', 'end_time' => '12:30:00'],
                ],
            ],
            'eventSummary' => [
                'customText' => [
                    'title' => "Contrat",
                    'content' => "Un petit contrat de test.",
                ],
                'materialDisplayMode' => 'categories',
                'showDescriptions' => false,
                'showLegalNumbers' => true,
                'showReplacementPrices' => true,
                'showPictures' => false,
                'showTags' => false,
            ],
            'calendar' => [
                'event' => [
                    'showBorrower' => false,
                    'showLocation' => true,
                ],
                'public' => [
                    'enabled' => true,
                    'url' => 'http://loxya.test/calendar/public/dfe7cd82-52b9-4c9b-aaed-033df210f23b.ics',
                    'displayedPeriod' => 'operation',
                ],
            ],
            'returnInventory' => [
                'mode' => 'start-empty',
            ],
            'billing' => [
                'defaultDegressiveRate' => 1,
                'defaultTax' => 1,
            ],
            'estimates' => [
                'customText' => [
                    'title' => "Modalité de paiement",
                    'content' => "Paiement par virement ou chèque.",
                ],
                'showBookingDescription' => false,
                'showMobilizationPeriod' => false,
                'showTotalReplacementPrice' => false,
                'showTotalisableProperties' => false,
                'showPictures' => false,
                'showDescriptions' => false,
                'showReplacementPrices' => true,
                'showUnitPrices' => true,
            ],
            'invoices' => [
                'customText' => [
                    'title' => null,
                    'content' => "Paiement attendu sous 30 jours.",
                ],
                'showBookingDescription' => false,
                'showMobilizationPeriod' => false,
                'showTotalReplacementPrice' => false,
                'showTotalisableProperties' => false,
                'showPictures' => false,
                'showDescriptions' => false,
                'showReplacementPrices' => true,
                'showUnitPrices' => true,
            ],
        ]);
    }

    public function testUpdateBadKey(): void
    {
        $this->client->put('/api/settings', [
            'inexistant_settings' => 'some-value',
            'eventSummary.customText.title' => null,
        ]);
        $this->assertApiValidationError([
            'inexistant_settings' => "This setting does not exists.",
        ]);
    }

    public function testUpdateBadValue(): void
    {
        $this->client->put('/api/settings', [
            'calendar.event.showBorrower' => 'foo',
            'eventSummary.materialDisplayMode' => 'not-valid',
            'eventSummary.customText.title' => str_repeat('A', 192),
            'calendar.public.uuid' => 'not-valid',
            'calendar.public.displayedPeriod' => 'not-valid',
            'billing.defaultDegressiveRate' => 1000,
            'billing.defaultTax' => 1000,
        ]);
        $this->assertApiValidationError([
            'calendar.event.showBorrower' => "This field should be a boolean.",
            'eventSummary.materialDisplayMode' => "This field is invalid.",
            'eventSummary.customText.title' => "Max. 191 characters.",
            'calendar.public.uuid' => "This unique identifier (UUID) is invalid.",
            'calendar.public.displayedPeriod' => "This field is invalid.",
            'billing.defaultTax' => "This field is invalid.",
            'billing.defaultDegressiveRate' => "This field is invalid.",
        ]);
    }

    public function testUpdate(): void
    {
        $this->client->put('/api/settings', [
            'eventSummary' => [
                'customText' => [
                    'title' => 'foo',
                    'content' => 'bar',
                ],
                'materialDisplayMode' => 'categories',
                'showLegalNumbers' => true,
                'showReplacementPrices' => false,
                'showDescriptions' => true,
                'showTags' => true,
                'showPictures' => true,
            ],
            'calendar' => [
                'event' => [
                    'showBorrower' => false,
                    'showLocation' => false,
                ],
                'public' => [
                    'enabled' => false,
                    'displayedPeriod' => 'both',
                ],
            ],
            'returnInventory' => [
                'mode' => 'start-full',
            ],
            'billing' => [
                'defaultDegressiveRate' => 3,
                'defaultTax' => 5,
            ],
            'estimates' => [
                'customText' => [
                    'title' => "Modalité de paiement",
                    'content' => "Paiement par virement ou chèque.",
                ],
                'showBookingDescription' => false,
                'showMobilizationPeriod' => false,
                'showTotalReplacementPrice' => false,
                'showTotalisableProperties' => true,
                'showPictures' => false,
                'showDescriptions' => false,
                'showReplacementPrices' => true,
                'showUnitPrices' => false,
            ],
            'invoices' => [
                'customText' => [
                    'title' => null,
                    'content' => "Paiement attendu sous 30 jours.",
                ],
                'showBookingDescription' => false,
                'showMobilizationPeriod' => false,
                'showTotalReplacementPrice' => false,
                'showTotalisableProperties' => false,
                'showPictures' => false,
                'showDescriptions' => false,
                'showReplacementPrices' => true,
                'showUnitPrices' => true,
            ],
        ]);
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseData([
            'general' => [
                'openingHours' => [
                    ['weekday' => 0, 'start_time' => '09:00:00', 'end_time' => '18:00:00'],
                    ['weekday' => 1, 'start_time' => '09:00:00', 'end_time' => '18:00:00'],
                    ['weekday' => 3, 'start_time' => '09:00:00', 'end_time' => '12:00:00'],
                    ['weekday' => 3, 'start_time' => '14:00:00', 'end_time' => '18:00:00'],
                    ['weekday' => 4, 'start_time' => '09:00:00', 'end_time' => '24:00:00'],
                    ['weekday' => 5, 'start_time' => '09:00:00', 'end_time' => '18:00:00'],
                    ['weekday' => 6, 'start_time' => '09:45:00', 'end_time' => '12:30:00'],
                ],
            ],
            'eventSummary' => [
                'customText' => [
                    'title' => 'foo',
                    'content' => 'bar',
                ],
                'materialDisplayMode' => 'categories',
                'showDescriptions' => true,
                'showLegalNumbers' => true,
                'showReplacementPrices' => false,
                'showTags' => true,
                'showPictures' => true,
            ],
            'calendar' => [
                'event' => [
                    'showBorrower' => false,
                    'showLocation' => false,
                ],
                'public' => [
                    'enabled' => false,
                ],
            ],
            'returnInventory' => [
                'mode' => 'start-full',
            ],
            'billing' => [
                'defaultDegressiveRate' => 3,
                'defaultTax' => 5,
            ],
            'estimates' => [
                'customText' => [
                    'title' => "Modalité de paiement",
                    'content' => "Paiement par virement ou chèque.",
                ],
                'showBookingDescription' => false,
                'showMobilizationPeriod' => false,
                'showTotalReplacementPrice' => false,
                'showTotalisableProperties' => true,
                'showPictures' => false,
                'showDescriptions' => false,
                'showReplacementPrices' => true,
                'showUnitPrices' => false,
            ],
            'invoices' => [
                'customText' => [
                    'title' => null,
                    'content' => "Paiement attendu sous 30 jours.",
                ],
                'showBookingDescription' => false,
                'showMobilizationPeriod' => false,
                'showTotalReplacementPrice' => false,
                'showTotalisableProperties' => false,
                'showPictures' => false,
                'showDescriptions' => false,
                'showReplacementPrices' => true,
                'showUnitPrices' => true,
            ],
        ]);

        // - Syntaxe alternative
        $this->client->put('/api/settings', [
            'calendar.event.showBorrower' => true,
            'eventSummary.materialDisplayMode' => 'flat',
            'eventSummary.customText.title' => null,
            'eventSummary.customText.content' => null,
            'eventSummary.showLegalNumbers' => false,
            'eventSummary.showReplacementPrices' => false,
            'eventSummary.showDescriptions' => true,
            'eventSummary.showTags' => true,
            'eventSummary.showPictures' => true,
            'calendar.public.enabled' => true,
            'calendar.public.displayedPeriod' => 'mobilization',
            'billing.defaultDegressiveRate' => null,
            'billing.defaultTax' => null,
            'estimates.showTotalisableProperties' => true,
            'estimates.showUnitPrices' => false,
        ]);
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseData([
            'general' => [
                'openingHours' => [
                    ['weekday' => 0, 'start_time' => '09:00:00', 'end_time' => '18:00:00'],
                    ['weekday' => 1, 'start_time' => '09:00:00', 'end_time' => '18:00:00'],
                    ['weekday' => 3, 'start_time' => '09:00:00', 'end_time' => '12:00:00'],
                    ['weekday' => 3, 'start_time' => '14:00:00', 'end_time' => '18:00:00'],
                    ['weekday' => 4, 'start_time' => '09:00:00', 'end_time' => '24:00:00'],
                    ['weekday' => 5, 'start_time' => '09:00:00', 'end_time' => '18:00:00'],
                    ['weekday' => 6, 'start_time' => '09:45:00', 'end_time' => '12:30:00'],
                ],
            ],
            'eventSummary' => [
                'customText' => [
                    'title' => null,
                    'content' => null,
                ],
                'materialDisplayMode' => 'flat',
                'showDescriptions' => true,
                'showLegalNumbers' => false,
                'showReplacementPrices' => false,
                'showTags' => true,
                'showPictures' => true,
            ],
            'calendar' => [
                'event' => [
                    'showBorrower' => true,
                    'showLocation' => false,
                ],
                'public' => [
                    'enabled' => true,
                    'displayedPeriod' => 'mobilization',
                    'url' => 'http://loxya.test/calendar/public/dfe7cd82-52b9-4c9b-aaed-033df210f23b.ics',
                ],
            ],
            'returnInventory' => [
                'mode' => 'start-full',
            ],
            'billing' => [
                'defaultDegressiveRate' => null,
                'defaultTax' => null,
            ],
            'estimates' => [
                'customText' => [
                    'title' => "Modalité de paiement",
                    'content' => "Paiement par virement ou chèque.",
                ],
                'showBookingDescription' => false,
                'showMobilizationPeriod' => false,
                'showTotalReplacementPrice' => false,
                'showTotalisableProperties' => true,
                'showPictures' => false,
                'showDescriptions' => false,
                'showReplacementPrices' => true,
                'showUnitPrices' => false,
            ],
            'invoices' => [
                'customText' => [
                    'title' => null,
                    'content' => "Paiement attendu sous 30 jours.",
                ],
                'showBookingDescription' => false,
                'showMobilizationPeriod' => false,
                'showTotalReplacementPrice' => false,
                'showTotalisableProperties' => false,
                'showPictures' => false,
                'showDescriptions' => false,
                'showReplacementPrices' => true,
                'showUnitPrices' => true,
            ],
        ]);
    }

    public function testReset(): void
    {
        // - Par défaut, le mode d'affichage du matériel est `sub-categories`.
        $this->client->delete('/api/settings/eventSummary.materialDisplayMode');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseHasKeyEquals('eventSummary.materialDisplayMode', 'sub-categories');

        // - Par défaut, l'UUID de calendrier est un UUID aléatoire.
        $this->client->delete('/api/settings/calendar.public.url');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseHasKeyNotEquals(
            'calendar.public.url',
            'http://loxya.test/calendar/public/dfe7cd82-52b9-4c9b-aaed-033df210f23b.ics',
        );

        // - Par défaut, le calendrier public est désactivé.
        $this->client->delete('/api/settings/calendar.public.enabled');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseHasKeyEquals('calendar.public.enabled', false);
    }
}
