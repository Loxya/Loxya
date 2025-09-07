import requester from '@/globals/requester';
import apiTechnicians from '@/stores/api/technicians';
import { withPaginationEnvelope } from '@fixtures/@utils';
import Period from '@/utils/period';
import documents from '@fixtures/documents';
import data from '@fixtures/technicians';

describe('Technicians Api', () => {
    describe('all()', () => {
        it('parse the returned data correctly', async () => {
            const paginatedData = withPaginationEnvelope(data.default());
            jest.spyOn(requester, 'get').mockResolvedValue(paginatedData);
            await expect(apiTechnicians.all()).resolves.toMatchSnapshot();
        });
    });

    describe('allWhileEvent()', () => {
        it('parse the returned data correctly', async () => {
            jest.spyOn(requester, 'get').mockResolvedValue(data.withEvents());
            await expect(apiTechnicians.allWhileEvent(1)).resolves.toMatchSnapshot();
        });
    });

    describe('allWithAssignments()', () => {
        const period = new Period('2024-01-01', '2024-01-02', true);

        it('parse the returned data correctly when paginated', async () => {
            const paginatedData = withPaginationEnvelope(data.withEvents());

            jest.spyOn(requester, 'get').mockResolvedValue(paginatedData);
            await expect(apiTechnicians.allWithAssignments({ period })).resolves.toMatchSnapshot();
        });

        it('parse the returned data correctly when not paginated', async () => {
            jest.spyOn(requester, 'get').mockResolvedValue(data.withEvents());
            const response = await apiTechnicians.allWithAssignments({ paginated: false, period });
            expect(response).toMatchSnapshot();
        });
    });

    describe('one()', () => {
        it.each(data.details())('parse the returned data correctly (with #$id)', async (datum: any) => {
            jest.spyOn(requester, 'get').mockResolvedValue(datum);
            await expect(apiTechnicians.one(datum.id)).resolves.toMatchSnapshot();
        });
    });

    describe('create()', () => {
        it.each(data.details())('parse the returned data correctly (with #$id)', async (datum: any) => {
            jest.spyOn(requester, 'post').mockResolvedValue(datum);
            await expect(apiTechnicians.create({} as any)).resolves.toMatchSnapshot();
        });
    });

    describe('update()', () => {
        it.each(data.details())('parse the returned data correctly (with #$id)', async (datum: any) => {
            jest.spyOn(requester, 'put').mockResolvedValue(datum);
            await expect(apiTechnicians.update(datum.id, {} as any)).resolves.toMatchSnapshot();
        });
    });

    describe('documents()', () => {
        it('parse the returned data correctly', async () => {
            jest.spyOn(requester, 'get').mockResolvedValue(documents.default());
            await expect(apiTechnicians.documents(1)).resolves.toMatchSnapshot();
        });
    });

    describe('assignments()', () => {
        it.each(data.withEvents())('parse the returned data correctly (with #$id)', async (datum: any) => {
            jest.spyOn(requester, 'get').mockResolvedValue(datum.events);
            await expect(apiTechnicians.assignments(datum.id)).resolves.toMatchSnapshot();
        });
    });

    describe('attachDocument()', () => {
        it.each(documents.default())('parse the returned data correctly (with document #$id)', async (datum: any) => {
            jest.spyOn(requester, 'post').mockResolvedValue(datum);
            const fakeFile = new File(['__TEST__'], 'my-document.txt', { type: 'text/plain' });
            await expect(apiTechnicians.attachDocument(1, fakeFile)).resolves.toMatchSnapshot();
        });
    });

    describe('restore()', () => {
        it.each(data.details())('parse the returned data correctly (with #$id)', async (datum: any) => {
            jest.spyOn(requester, 'put').mockResolvedValue(datum);
            await expect(apiTechnicians.restore(datum.id)).resolves.toMatchSnapshot();
        });
    });
});
