import requester from '@/globals/requester';
import apiSubCategories from '@/stores/api/subcategories';
import data from '@fixtures/subcategories';

describe('SubCategories Api', () => {
    describe('create()', () => {
        it.each(data.default())('parse the returned data correctly (with #$id)', async (datum: any) => {
            jest.spyOn(requester, 'post').mockResolvedValue(datum);
            await expect(apiSubCategories.create({} as any)).resolves.toMatchSnapshot();
        });
    });

    describe('update()', () => {
        it.each(data.default())('parse the returned data correctly (with #$id)', async (datum: any) => {
            jest.spyOn(requester, 'put').mockResolvedValue(datum);
            await expect(apiSubCategories.update(datum.id, {} as any)).resolves.toMatchSnapshot();
        });
    });
});
