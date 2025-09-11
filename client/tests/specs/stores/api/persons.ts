import requester from '@/globals/requester';
import apiPersons from '@/stores/api/persons';
import { withPaginationEnvelope } from '@fixtures/@utils';
import data from '@fixtures/persons';

describe('Persons Api', () => {
    describe('all()', () => {
        it('parse the returned data correctly', async () => {
            const paginatedData = withPaginationEnvelope(data.default());
            jest.spyOn(requester, 'get').mockResolvedValue(paginatedData);
            await expect(apiPersons.all()).resolves.toMatchSnapshot();
        });
    });
});
