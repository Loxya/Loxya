import { z } from '@/utils/validation';
import requester from '@/globals/requester';
import { UserDetailsSchema, UserSettingsSchema } from './users';

import type { SchemaInfer } from '@/utils/validation';

// ------------------------------------------------------
// -
// -    Schema / Enums
// -
// ------------------------------------------------------

/** Contextes de l'application (Où se trouve l'utilisateur ?). */
export enum AppContext {
    /**
     * Back-office de l'application.
     * (= Partie accessible par les membres du staff).
     */
    INTERNAL = 'internal',
}

/** Représente le type d'authentification associé à une session. */
export enum AuthType {
    /** Utilisateur disposant d'un compte enregistré dans le système. */
    USER = 'user',

    /** Utilisateur temporaire, ne disposant pas encore d'un compte enregistré. */
    GUEST = 'guest',
}

const PendingUserSessionSchema = z
    .strictObject({
        type: z.literal(AuthType.GUEST),
    });

export const UserSessionSchema = z
    .strictObject({
        type: z.literal(AuthType.USER),
    })
    .merge(UserDetailsSchema)
    .merge(UserSettingsSchema);

const SessionSchema = z.union([
    PendingUserSessionSchema,
    UserSessionSchema,
]);

export const NewUserSessionSchema = z
    .strictObject({
        token: z.string(),
    })
    .merge(UserSessionSchema);

// ------------------------------------------------------
// -
// -    Types
// -
// ------------------------------------------------------

export type Session<WithPending extends boolean = false> =
    WithPending extends false
        ? SchemaInfer<typeof UserSessionSchema>
        : SchemaInfer<typeof SessionSchema>;

export type NewUserSession = SchemaInfer<typeof NewUserSessionSchema>;

//
// - Edition
//

export type Credentials = {
    identifier: string,
    password: string,
    context?: AppContext,
};

// ------------------------------------------------------
// -
// -    Fonctions
// -
// ------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-arguments
async function get(withPending?: false): Promise<Session<false>>;
async function get(withPending: true): Promise<Session<true>>;
async function get(withPending: boolean = false): Promise<Session<boolean>> {
    const params = withPending ? { withPending: true } : {};
    const response = await requester.get('/session', { params });

    return withPending
        ? SessionSchema.parse(response)
        : UserSessionSchema.parse(response);
}

const create = async (credentials: Credentials): Promise<NewUserSession> => {
    const response = await requester.post('/session', credentials);
    return NewUserSessionSchema.parse(response);
};

export default { get, create };
