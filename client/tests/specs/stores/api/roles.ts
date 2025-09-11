import requester from '@/globals/requester';
import apiRoles from '@/stores/api/roles';
import data from '@fixtures/roles';

describe('Roles Api', () => {
    describe('all()', () => {
        it('parse the returned data correctly', async () => {
            jest.spyOn(requester, 'get').mockResolvedValue(data.default());
            await expect(apiRoles.all()).resolves.toMatchSnapshot();
        });
    });

    describe('create()', () => {
        it.each(data.default())('parse the returned data correctly (with #$id)', async (datum: any) => {
            jest.spyOn(requester, 'post').mockResolvedValue(datum);
            await expect(apiRoles.create({} as any)).resolves.toMatchSnapshot();
        });
    });

    describe('update()', () => {
        it.each(data.default())('parse the returned data correctly (with #$id)', async (datum: any) => {
            jest.spyOn(requester, 'put').mockResolvedValue(datum);
            await expect(apiRoles.update(datum.id, {} as any)).resolves.toMatchSnapshot();
        });
    });
});
