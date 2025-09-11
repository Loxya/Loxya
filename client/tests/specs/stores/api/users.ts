import requester from '@/globals/requester';
import apiUsers from '@/stores/api/users';
import { withPaginationEnvelope } from '@fixtures/@utils';
import data from '@fixtures/users';

describe('Users Api', () => {
    describe('all()', () => {
        it('parse the returned data correctly', async () => {
            const paginatedData = withPaginationEnvelope(data.default());
            jest.spyOn(requester, 'get').mockResolvedValue(paginatedData);
            await expect(apiUsers.all()).resolves.toMatchSnapshot();
        });
    });

    describe('one()', () => {
        it('parse the returned data correctly', async () => {
            // - Avec lui-même.
            jest.spyOn(requester, 'get').mockResolvedValue(data.details(1));
            await expect(apiUsers.one('self')).resolves.toMatchSnapshot();

            // - Avec les autres utilisateurs.
            await Promise.all(
                data.details().map(async (datum: any) => {
                    jest.spyOn(requester, 'get').mockResolvedValue(datum);
                    await expect(apiUsers.one(datum.id)).resolves.toMatchSnapshot();
                }),
            );
        });
    });

    describe('create()', () => {
        it.each(data.details())('parse the returned data correctly (with #$id)', async (datum: any) => {
            jest.spyOn(requester, 'post').mockResolvedValue(datum);
            await expect(apiUsers.create({} as any)).resolves.toMatchSnapshot();
        });
    });

    describe('update()', () => {
        it('parse the returned data correctly', async () => {
            jest.spyOn(requester, 'put').mockResolvedValue(data.details(1));
            await expect(apiUsers.update('self', {} as any)).resolves.toMatchSnapshot();

            // - Avec les autres utilisateurs.
            await Promise.all(
                data.details().map(async (datum: any) => {
                    if (datum.id === 1) {
                        return;
                    }

                    jest.spyOn(requester, 'put').mockResolvedValue(datum);
                    await expect(apiUsers.update(datum.id, {} as any)).resolves.toMatchSnapshot();
                }),
            );
        });
    });

    describe('getSettings()', () => {
        it('parse the returned data correctly', async () => {
            // - Avec lui-même.
            jest.spyOn(requester, 'get').mockResolvedValue(data.settings(1));
            await expect(apiUsers.getSettings('self')).resolves.toMatchSnapshot();

            // - Avec les autres utilisateurs.
            await Promise.all(
                data.settings().map(async (datum: any) => {
                    jest.spyOn(requester, 'get').mockResolvedValue(datum);
                    await expect(apiUsers.getSettings(datum.id)).resolves.toMatchSnapshot();
                }),
            );
        });
    });

    describe('updateSettings()', () => {
        it('parse the returned data correctly', async () => {
            jest.spyOn(requester, 'put').mockResolvedValue(data.settings(1));
            await expect(apiUsers.updateSettings('self', {} as any)).resolves.toMatchSnapshot();

            // - Avec les autres utilisateurs.
            await Promise.all(
                data.settings().map(async (datum: any) => {
                    if (datum.id === 1) {
                        return;
                    }

                    jest.spyOn(requester, 'put').mockResolvedValue(datum);
                    await expect(apiUsers.updateSettings(datum.id, {} as any)).resolves.toMatchSnapshot();
                }),
            );
        });
    });

    describe('restore()', () => {
        it.each(data.details())('parse the returned data correctly (with #$id)', async (datum: any) => {
            jest.spyOn(requester, 'put').mockResolvedValue(datum);
            await expect(apiUsers.restore(datum.id)).resolves.toMatchSnapshot();
        });
    });
});
