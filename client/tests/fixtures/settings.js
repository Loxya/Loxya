import deepFreeze from 'deep-freeze-strict';
import {
    ReturnInventoryMode,
    MaterialDisplayMode,
    PublicCalendarPeriodDisplay,
} from '@/stores/api/settings';

const data = deepFreeze({
    general: {
        openingHours: [
            { weekday: 1, start_time: '09:00:00', end_time: '17:30:00' },
            { weekday: 2, start_time: '09:00:00', end_time: '17:30:00' },
            { weekday: 3, start_time: '09:00:00', end_time: '12:45:00' },
            { weekday: 4, start_time: '09:00:00', end_time: '17:30:00' },
            { weekday: 5, start_time: '09:00:00', end_time: '17:30:00' },
            { weekday: 6, start_time: '10:00:00', end_time: '12:00:00' },
        ],
    },
    eventSummary: {
        customText: {
            title: `Contrat`,
            content: null,
        },
        materialDisplayMode: MaterialDisplayMode.CATEGORIES,
        showLegalNumbers: true,
        showReplacementPrices: true,
        showDescriptions: false,
        showTags: false,
        showPictures: false,
    },
    calendar: {
        event: {
            showBorrower: false,
            showLocation: true,
        },
        public: {
            enabled: true,
            url: 'http://loxya.test/calendar/public/dfe7cd82-52b9-4c9b-aaed-033df210f23b.ics',
            displayedPeriod: PublicCalendarPeriodDisplay.OPERATION,
        },
    },
    returnInventory: {
        mode: ReturnInventoryMode.START_EMPTY,
    },
    billing: {
        defaultDegressiveRate: 1,
        defaultTax: 1,
    },
    estimates: {
        customText: {
            title: 'Modalités de paiement',
            content: 'Paiement par virement ou chèque.',
        },
        showBookingDescription: false,
        showMobilizationPeriod: false,
        showTotalReplacementPrice: false,
        showTotalisableProperties: false,
        showPictures: false,
        showDescriptions: false,
        showReplacementPrices: true,
        showUnitPrices: true,
    },
    invoices: {
        customText: {
            title: null,
            content: 'Paiement attendu sous 30 jours.',
        },
        showBookingDescription: false,
        showMobilizationPeriod: false,
        showTotalReplacementPrice: false,
        showTotalisableProperties: false,
        showPictures: false,
        showDescriptions: false,
        showReplacementPrices: true,
        showUnitPrices: true,
    },
});

export default data;
