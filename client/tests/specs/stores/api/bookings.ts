import requester from '@/globals/requester';
import apiBookings from '@/stores/api/bookings';
import Period from '@/utils/period';
import { withPaginationEnvelope } from '@fixtures/@utils';
import data from '@fixtures/bookings';

describe('Bookings Api', () => {
    describe('all()', () => {
        it('parse the returned data correctly when paginated', async () => {
            const paginatedData = withPaginationEnvelope(data.excerpt());

            jest.spyOn(requester, 'get').mockResolvedValue(paginatedData);
            await expect(apiBookings.all()).resolves.toMatchSnapshot();
        });

        it('parse the returned data correctly when not paginated', async () => {
            jest.spyOn(requester, 'get').mockResolvedValue(data.excerpt());
            const period = new Period('2024-01-01', '2024-01-02', true);
            const response = await apiBookings.all({ paginated: false, period });
            expect(response).toMatchSnapshot();
        });
    });

    describe('one()', () => {
        it.each(data.default())('parse the returned data correctly', async (datum: any) => {
            jest.spyOn(requester, 'get').mockResolvedValue(datum);
            await expect(apiBookings.one(datum.entity, datum.id)).resolves.toMatchSnapshot();
        });
    });

    describe('oneSummary()', () => {
        it.each(data.summary())('parse the returned data correctly', async (datum: any) => {
            jest.spyOn(requester, 'get').mockResolvedValue(datum);
            await expect(apiBookings.oneSummary(datum.entity, datum.id)).resolves.toMatchSnapshot();
        });
    });

    describe('updateMaterials()', () => {
        it.each(data.default())('parse the returned data correctly', async (datum: any) => {
            jest.spyOn(requester, 'put').mockResolvedValue(datum);
            await expect(apiBookings.updateMaterials(datum.entity, datum.id, [] as any)).resolves.toMatchSnapshot();
        });
    });

    describe('updateBilling()', () => {
        it.each(data.default())('parse the returned data correctly', async (datum: any) => {
            jest.spyOn(requester, 'put').mockResolvedValue(datum);
            await expect(apiBookings.updateBilling(datum.entity, datum.id, {} as any)).resolves.toMatchSnapshot();
        });
    });

    describe('resynchronizeMaterial()', () => {
        it('parse the returned data correctly', async () => {
            const datum = data.default(2);
            jest.spyOn(requester, 'put').mockResolvedValue(datum.materials[0]);
            await expect(apiBookings.resynchronizeMaterial(datum.entity, datum.id, 2, ['name', 'reference'])).resolves.toMatchSnapshot();
        });
    });

    describe('resynchronizeExtra()', () => {
        it('parse the returned data correctly', async () => {
            const datum = data.default(2);
            jest.spyOn(requester, 'put').mockResolvedValue(datum.extras[0]);
            await expect(apiBookings.resynchronizeExtra(datum.entity, datum.id, 1, ['taxes'])).resolves.toMatchSnapshot();
        });
    });
});
