import requester from '@/globals/requester';
import apiSession from '@/stores/api/session';
import users from '@fixtures/users';

describe('Session Api', () => {
    describe('get()', () => {
        it.each(users.session())('parse the returned data correctly when its a user (with #$id)', async (datum: any) => {
            jest.spyOn(requester, 'get').mockResolvedValue(datum);
            await expect(apiSession.get()).resolves.toMatchSnapshot();
            await expect(apiSession.get(false)).resolves.toMatchSnapshot();
        });
    });

    describe('create()', () => {
        it.each(users.session())('parse the returned data correctly (with #$id)', async (datum: any) => {
            jest.spyOn(requester, 'post').mockResolvedValue(Object.assign(datum, { token: '__FAKE-TOKEN__' }));
            await expect(apiSession.create({} as any)).resolves.toMatchSnapshot();
        });
    });
});
