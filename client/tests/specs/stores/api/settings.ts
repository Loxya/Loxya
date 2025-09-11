import requester from '@/globals/requester';
import apiSettings from '@/stores/api/settings';
import data from '@fixtures/settings';

describe('Settings Api', () => {
    describe('all()', () => {
        it('parse the returned data correctly', async () => {
            jest.spyOn(requester, 'get').mockResolvedValue(data);
            await expect(apiSettings.all()).resolves.toMatchSnapshot();
        });
    });

    describe('update()', () => {
        it('parse the returned data correctly', async () => {
            jest.spyOn(requester, 'put').mockResolvedValue(data);
            await expect(apiSettings.update({} as any)).resolves.toMatchSnapshot();
        });
    });

    describe('reset()', () => {
        it('parse the returned data correctly', async () => {
            jest.spyOn(requester, 'delete').mockResolvedValue(data);
            await expect(apiSettings.reset('calendar.public.url')).resolves.toMatchSnapshot();
        });
    });
});
