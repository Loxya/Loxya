import requester from '@/globals/requester';
import apiPasswordReset from '@/stores/api/password-reset';

describe('Password Reset Api', () => {
    describe('create()', () => {
        it('parse the returned data correctly (with #$id)', async () => {
            jest.spyOn(requester, 'post').mockResolvedValue({
                resend_at: '2025-05-03T12:31:00.000000Z',
                expires_at: '2025-05-03T12:40:00.000000Z',
            });
            await expect(apiPasswordReset.create('test@loxya.com')).resolves.toMatchSnapshot();
        });
    });

    describe('verify()', () => {
        it('parse the returned data correctly (with #$id)', async () => {
            jest.spyOn(requester, 'put').mockResolvedValue({
                token: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzY29wZSI6InBhc3N3b3JkLXJlc2V0IiwiaWF0IjoxNzQ2Mjc1NDYxLCJleHAiOjE3NDYyNzYwNjEsImZwdCI6IjBkMTRiYjdjY2I5YWQ4NTE3YjEyOGUwZWVhNGQ1MzE3IiwiZW1haWwiOiJhbGV4LmR1cG9udEBsb3h5YS5jb20iLCJzdWIiOjN9.ssr9XlHnXcehjOhwgQnP_8IHiK77mWnq05bKiFJsNJc',
                expires_at: '2025-05-03T12:41:01.000000Z',
            });
            await expect(apiPasswordReset.verify('test@loxya.com', '123456')).resolves.toMatchSnapshot();
        });
    });
});
