import requester from '@/globals/requester';
import apiDegressiveRates from '@/stores/api/degressive-rates';
import data from '@fixtures/degressive-rates';

describe('Degressive Rates Api', () => {
    describe('all()', () => {
        it('parse the returned data correctly', async () => {
            jest.spyOn(requester, 'get').mockResolvedValue(data.default());
            await expect(apiDegressiveRates.all()).resolves.toMatchSnapshot();
        });
    });

    describe('create()', () => {
        it.each(data.default())('parse the returned data correctly (with #$id)', async (datum: any) => {
            jest.spyOn(requester, 'post').mockResolvedValue(datum);
            await expect(apiDegressiveRates.create({} as any)).resolves.toMatchSnapshot();
        });
    });

    describe('update()', () => {
        it.each(data.default())('parse the returned data correctly (with #$id)', async (datum: any) => {
            jest.spyOn(requester, 'put').mockResolvedValue(datum);
            await expect(apiDegressiveRates.update(datum.id, {} as any)).resolves.toMatchSnapshot();
        });
    });
});
