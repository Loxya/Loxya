import requester from '@/globals/requester';
import apiInvoices from '@/stores/api/invoices';
import { withPaginationEnvelope } from '@fixtures/@utils';
import data from '@fixtures/invoices';

describe('Invoices Api', () => {
    describe('all()', () => {
        it('parse the returned data correctly', async () => {
            const paginatedData = withPaginationEnvelope(data.default());
            jest.spyOn(requester, 'get').mockResolvedValue(paginatedData);
            await expect(apiInvoices.all()).resolves.toMatchSnapshot();
        });
    });

    describe('one()', () => {
        it('parse the returned data correctly', async () => {
            jest.spyOn(requester, 'get').mockResolvedValue(data.details(1));
            await expect(apiInvoices.one(1)).resolves.toMatchSnapshot();
        });
    });
});
