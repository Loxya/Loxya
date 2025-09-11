import requester from '@/globals/requester';
import apiCategories from '@/stores/api/categories';
import data from '@fixtures/categories';

describe('Categories Api', () => {
    describe('all()', () => {
        it('parse the returned data correctly', async () => {
            jest.spyOn(requester, 'get').mockResolvedValue(data.details());
            await expect(apiCategories.all()).resolves.toMatchSnapshot();
        });
    });

    describe('create()', () => {
        it.each(data.details())('parse the returned data correctly (with #$id)', async (datum: any) => {
            jest.spyOn(requester, 'post').mockResolvedValue(datum);
            await expect(apiCategories.create({} as any)).resolves.toMatchSnapshot();
        });
    });

    describe('update()', () => {
        it.each(data.details())('parse the returned data correctly (with #$id)', async (datum: any) => {
            jest.spyOn(requester, 'put').mockResolvedValue(datum);
            await expect(apiCategories.update(datum.id, {} as any)).resolves.toMatchSnapshot();
        });
    });
});
