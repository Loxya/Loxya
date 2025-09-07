import requester from '@/globals/requester';
import apiTaxes from '@/stores/api/taxes';
import data from '@fixtures/taxes';

describe('Taxes Api', () => {
    describe('all()', () => {
        it('parse the returned data correctly', async () => {
            jest.spyOn(requester, 'get').mockResolvedValue(data.default());
            await expect(apiTaxes.all()).resolves.toMatchSnapshot();
        });
    });

    describe('create()', () => {
        it.each(data.default())('parse the returned data correctly (with #$id)', async (datum: any) => {
            jest.spyOn(requester, 'post').mockResolvedValue(datum);
            await expect(apiTaxes.create({} as any)).resolves.toMatchSnapshot();
        });
    });

    describe('update()', () => {
        it.each(data.default())('parse the returned data correctly (with #$id)', async (datum: any) => {
            jest.spyOn(requester, 'put').mockResolvedValue(datum);
            await expect(apiTaxes.update(datum.id, {} as any)).resolves.toMatchSnapshot();
        });
    });
});
