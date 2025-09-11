import requester from '@/globals/requester';
import apiBeneficiaries from '@/stores/api/beneficiaries';
import { withPaginationEnvelope } from '@fixtures/@utils';
import estimates from '@fixtures/estimates';
import invoices from '@fixtures/invoices';
import bookings from '@fixtures/bookings';
import data from '@fixtures/beneficiaries';

describe('Beneficiaries Api', () => {
    describe('all()', () => {
        it('parse the returned data correctly', async () => {
            const paginatedData = withPaginationEnvelope(data.default());
            jest.spyOn(requester, 'get').mockResolvedValue(paginatedData);
            await expect(apiBeneficiaries.all()).resolves.toMatchSnapshot();
        });
    });

    describe('one()', () => {
        it.each(data.details())('parse the returned data correctly (with #$id)', async (datum: any) => {
            jest.spyOn(requester, 'get').mockResolvedValue(datum);
            await expect(apiBeneficiaries.one(datum.id)).resolves.toMatchSnapshot();
        });
    });

    describe('bookings()', () => {
        it('parse the returned data correctly', async () => {
            const paginatedData = withPaginationEnvelope(bookings.excerpt());
            jest.spyOn(requester, 'get').mockResolvedValue(paginatedData);
            await expect(apiBeneficiaries.bookings(1)).resolves.toMatchSnapshot();
        });
    });

    describe('estimates()', () => {
        it('parse the returned data correctly', async () => {
            jest.spyOn(requester, 'get').mockResolvedValue(estimates.default());
            await expect(apiBeneficiaries.estimates(1)).resolves.toMatchSnapshot();
        });
    });

    describe('invoices()', () => {
        it('parse the returned data correctly', async () => {
            jest.spyOn(requester, 'get').mockResolvedValue(invoices.default());
            await expect(apiBeneficiaries.invoices(1)).resolves.toMatchSnapshot();
        });
    });

    describe('create()', () => {
        it.each(data.details())('parse the returned data correctly (with #$id)', async (datum: any) => {
            jest.spyOn(requester, 'post').mockResolvedValue(datum);
            await expect(apiBeneficiaries.create({} as any)).resolves.toMatchSnapshot();
        });
    });

    describe('update()', () => {
        it.each(data.details())('parse the returned data correctly (with #$id)', async (datum: any) => {
            jest.spyOn(requester, 'put').mockResolvedValue(datum);
            await expect(apiBeneficiaries.update(datum.id, {} as any)).resolves.toMatchSnapshot();
        });
    });

    describe('restore()', () => {
        it.each(data.details())('parse the returned data correctly (with #$id)', async (datum: any) => {
            jest.spyOn(requester, 'put').mockResolvedValue(datum);
            await expect(apiBeneficiaries.restore(datum.id)).resolves.toMatchSnapshot();
        });
    });
});
