import requester from '@/globals/requester';
import apiMaterials from '@/stores/api/materials';
import { withPaginationEnvelope } from '@fixtures/@utils';
import documents from '@fixtures/documents';
import bookings from '@fixtures/bookings';
import data from '@fixtures/materials';

describe('Materials Api', () => {
    describe('all()', () => {
        it('parse the returned data correctly', async () => {
            const allData = data.withAvailability();
            const paginatedData = withPaginationEnvelope(allData);

            // - Avec pagination (1).
            jest.spyOn(requester, 'get').mockResolvedValue(paginatedData);
            await expect(apiMaterials.all()).resolves.toMatchSnapshot();

            // - Avec pagination (2).
            jest.spyOn(requester, 'get').mockResolvedValue(paginatedData);
            await expect(apiMaterials.all({ paginated: true })).resolves.toMatchSnapshot();

            // - Sans pagination.
            jest.spyOn(requester, 'get').mockResolvedValue(allData);
            await expect(apiMaterials.all({ paginated: false })).resolves.toMatchSnapshot();
        });
    });

    describe('allWhileEvent()', () => {
        it('parse the returned data correctly', async () => {
            jest.spyOn(requester, 'get').mockResolvedValue(data.withContext());
            await expect(apiMaterials.allWhileEvent(1)).resolves.toMatchSnapshot();
        });
    });

    describe('one()', () => {
        it.each(data.details())('parse the returned data correctly (with #$id)', async (datum: any) => {
            jest.spyOn(requester, 'get').mockResolvedValue(datum);
            await expect(apiMaterials.one(datum.id)).resolves.toMatchSnapshot();
        });
    });

    describe('create()', () => {
        it.each(data.details())('parse the returned data correctly (with #$id)', async (datum: any) => {
            jest.spyOn(requester, 'post').mockResolvedValue(datum);
            await expect(apiMaterials.create({} as any)).resolves.toMatchSnapshot();
        });
    });

    describe('update()', () => {
        it.each(data.details())('parse the returned data correctly (with #$id)', async (datum: any) => {
            jest.spyOn(requester, 'put').mockResolvedValue(datum);
            await expect(apiMaterials.update(datum.id, {} as any)).resolves.toMatchSnapshot();
        });
    });

    describe('bookings()', () => {
        it('parse the returned data correctly', async () => {
            const paginatedData = withPaginationEnvelope(
                bookings.summary().map((booking: any) => ({
                    ...booking,
                    pivot: {
                        quantity: 12,
                    },
                })),
            );
            jest.spyOn(requester, 'get').mockResolvedValue(paginatedData);
            await expect(apiMaterials.bookings(1)).resolves.toMatchSnapshot();
        });
    });

    describe('documents()', () => {
        it('parse the returned data correctly', async () => {
            jest.spyOn(requester, 'get').mockResolvedValue(documents.default());
            await expect(apiMaterials.documents(1)).resolves.toMatchSnapshot();
        });
    });

    describe('attachDocument()', () => {
        it.each(documents.default())('parse the returned data correctly (with document #$id)', async (datum: any) => {
            jest.spyOn(requester, 'post').mockResolvedValue(datum);
            const fakeFile = new File(['__TEST__'], 'my-document.txt', { type: 'text/plain' });
            await expect(apiMaterials.attachDocument(1, fakeFile)).resolves.toMatchSnapshot();
        });
    });

    describe('restore()', () => {
        it.each(data.details())('parse the returned data correctly (with #$id)', async (datum: any) => {
            jest.spyOn(requester, 'put').mockResolvedValue(datum);
            await expect(apiMaterials.restore(datum.id)).resolves.toMatchSnapshot();
        });
    });
});
