import events from '@fixtures/parsed/events';
import getEmbeddedMaterialsQuantities from '../getEmbeddedMaterialsQuantities';

describe('MaterialsSelector / Utils / getEmbeddedMaterialsQuantities()', () => {
    it('should return an array of objects containing the quantities related to an event material', () => {
        expect(getEmbeddedMaterialsQuantities(events.details(7).materials)).toEqual([
            {
                id: 6,
                quantity: 2,
            },
            {
                id: 1,
                quantity: 2,
            },
            {
                id: 4,
                quantity: 2,
            },
            {
                id: 7,
                quantity: 1,
            },
        ]);
    });
});
