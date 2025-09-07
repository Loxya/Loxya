import requester from '@/globals/requester';
import apiCompanies from '@/stores/api/companies';
import { withPaginationEnvelope } from '@fixtures/@utils';
import data from '@fixtures/companies';

describe('Companies Api', () => {
    describe('all()', () => {
        it('parse the returned data correctly', async () => {
            const paginatedData = withPaginationEnvelope(data.default());
            jest.spyOn(requester, 'get').mockResolvedValue(paginatedData);
            await expect(apiCompanies.all()).resolves.toMatchSnapshot();
        });
    });

    describe('one()', () => {
        it.each(data.default())('parse the returned data correctly (with #$id)', async (datum: any) => {
            jest.spyOn(requester, 'get').mockResolvedValue(datum);
            await expect(apiCompanies.one(datum.id)).resolves.toMatchSnapshot();
        });
    });

    describe('create()', () => {
        it.each(data.default())('parse the returned data correctly (with #$id)', async (datum: any) => {
            jest.spyOn(requester, 'post').mockResolvedValue(datum);
            await expect(apiCompanies.create({} as any)).resolves.toMatchSnapshot();
        });
    });

    describe('update()', () => {
        it.each(data.default())('parse the returned data correctly (with #$id)', async (datum: any) => {
            jest.spyOn(requester, 'put').mockResolvedValue(datum);
            await expect(apiCompanies.update(datum.id, {} as any)).resolves.toMatchSnapshot();
        });
    });
});
