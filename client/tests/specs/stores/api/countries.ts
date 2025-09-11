import requester from '@/globals/requester';
import apiCountries from '@/stores/api/countries';
import data from '@fixtures/countries';

describe('Countries Api', () => {
    describe('all()', () => {
        it('parse the returned data correctly', async () => {
            jest.spyOn(requester, 'get').mockResolvedValue(data.default());
            await expect(apiCountries.all()).resolves.toMatchSnapshot();
        });
    });
});
