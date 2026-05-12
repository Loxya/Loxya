import requester from '@/globals/requester';
import apiEstimates from '@/stores/api/estimates';
import { withPaginationEnvelope } from '@fixtures/@utils';
import data from '@fixtures/estimates';

describe('Estimates Api', () => {
    describe('all()', () => {
        it('parse the returned data correctly', async () => {
            const paginatedData = withPaginationEnvelope(data.default());
            jest.spyOn(requester, 'get').mockResolvedValue(paginatedData);
            await expect(apiEstimates.all()).resolves.toMatchSnapshot();
        });
    });

    describe('one()', () => {
        it('parse the returned data correctly', async () => {
            jest.spyOn(requester, 'get').mockResolvedValue(data.details(1));
            await expect(apiEstimates.one(1)).resolves.toMatchSnapshot();
        });
    });
});
