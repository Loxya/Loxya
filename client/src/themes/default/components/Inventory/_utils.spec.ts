import { groupByCategories } from './_utils';
import categories from '@fixtures/parsed/categories';
import events from '@fixtures/parsed/events';

import type { AwaitedMaterial } from './_types';
import type { EventMaterial } from '@/stores/api/events';

describe('Inventory Utils', () => {
    describe('groupByCategories()', () => {
        it('returns an empty array with empty values', () => {
            expect(groupByCategories([], categories.default())).toEqual([]);
        });

        it('dispatch a list of event materials by categories', () => {
            const awaitedMaterials: AwaitedMaterial[] = events.details(7).materials.map(
                (eventMaterial: EventMaterial): AwaitedMaterial => {
                    const { id, name, reference, quantity, material } = eventMaterial;

                    return {
                        id,
                        name,
                        reference,
                        category_id: material.category_id,
                        sub_category_id: material.sub_category_id,
                        tags: material.tags,
                        park_id: material.park_id,
                        awaitedQuantity: quantity,
                    };
                },
            );

            const result = groupByCategories(awaitedMaterials, categories.default());
            expect(result).toStrictEqual([
                {
                    id: 2,
                    name: 'Lumière',
                    materials: [
                        awaitedMaterials[2],
                    ],
                },
                {
                    id: 1,
                    name: 'Son',
                    materials: [
                        awaitedMaterials[0],
                        awaitedMaterials[1],

                    ],
                },
                {
                    id: 3,
                    name: 'Transport',
                    materials: [
                        awaitedMaterials[3],
                    ],
                },
            ]);
        });
    });
});
