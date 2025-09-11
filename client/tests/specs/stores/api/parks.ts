import requester from '@/globals/requester';
import apiParks from '@/stores/api/parks';
import materials from '@fixtures/materials';
import { withPaginationEnvelope } from '@fixtures/@utils';
import data from '@fixtures/parks';
import Decimal from 'decimal.js';

describe('Parks Api', () => {
    describe('all()', () => {
        it('parse the returned data correctly', async () => {
            const paginatedData = withPaginationEnvelope(data.default());
            jest.spyOn(requester, 'get').mockResolvedValue(paginatedData);
            await expect(apiParks.all()).resolves.toMatchSnapshot();
        });
    });

    describe('list()', () => {
        it('parse the returned data correctly', async () => {
            jest.spyOn(requester, 'get').mockResolvedValue(data.summary());
            await expect(apiParks.list()).resolves.toMatchSnapshot();
        });
    });

    describe('one()', () => {
        it.each(data.details())('parse the returned data correctly (with #$id)', async (datum: any) => {
            jest.spyOn(requester, 'get').mockResolvedValue(datum);
            await expect(apiParks.one(datum.id)).resolves.toMatchSnapshot();
        });
    });

    describe('oneTotalAmount()', () => {
        it('parse the returned data correctly', async () => {
            jest.spyOn(requester, 'get').mockResolvedValue('119_061.80');

            const result = await apiParks.oneTotalAmount(1);
            expect(result).toBeInstanceOf(Decimal);
            expect(result.toString()).toBe('119061.8');
        });
    });

    describe('materials()', () => {
        it('parse the returned data correctly', async () => {
            jest.spyOn(requester, 'get').mockResolvedValue(materials.default());
            await expect(apiParks.materials(1)).resolves.toMatchSnapshot();
        });
    });

    describe('create()', () => {
        it.each(data.details())('parse the returned data correctly (with #$id)', async (datum: any) => {
            jest.spyOn(requester, 'post').mockResolvedValue(datum);
            await expect(apiParks.create({} as any)).resolves.toMatchSnapshot();
        });
    });

    describe('update()', () => {
        it.each(data.details())('parse the returned data correctly (with #$id)', async (datum: any) => {
            jest.spyOn(requester, 'put').mockResolvedValue(datum);
            await expect(apiParks.update(datum.id, {} as any)).resolves.toMatchSnapshot();
        });
    });

    describe('restore()', () => {
        it.each(data.details())('parse the returned data correctly (with #$id)', async (datum: any) => {
            jest.spyOn(requester, 'put').mockResolvedValue(datum);
            await expect(apiParks.restore(datum.id)).resolves.toMatchSnapshot();
        });
    });
});
