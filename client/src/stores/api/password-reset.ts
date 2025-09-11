import { z } from '@/utils/validation';
import requester from '@/globals/requester';

import type { SchemaInfer } from '@/utils/validation';

// ------------------------------------------------------
// -
// -    Schema / Enums
// -
// ------------------------------------------------------$

const PasswordResetSchema = z.strictObject({
    resend_at: z.datetime(),
    expires_at: z.datetime(),
});

const PasswordResetTokenSchema = z.strictObject({
    token: z.string(),
    expires_at: z.datetime(),
});

// ------------------------------------------------------
// -
// -    Types
// -
// ------------------------------------------------------

export type PasswordReset = SchemaInfer<typeof PasswordResetSchema>;
export type PasswordResetToken = SchemaInfer<typeof PasswordResetTokenSchema>;

// ------------------------------------------------------
// -
// -    Fonctions
// -
// ------------------------------------------------------

const create = async (email: string): Promise<PasswordReset> => {
    const response = await requester.post('/password-reset', { email });
    return PasswordResetSchema.parse(response);
};

const verify = async (email: string, code: string): Promise<PasswordResetToken> => {
    const response = await requester.put('/password-reset', { email, code });
    return PasswordResetTokenSchema.parse(response);
};

const finalize = async (token: string, newPassword: string): Promise<void> => {
    await requester.post('/password-reset/set', { password: newPassword }, {
        headers: { 'X-Reset-Token': token },
    });
};

export default {
    create,
    verify,
    finalize,
};
