import { z } from '@/utils/validation';
import requester from '@/globals/requester';
import { Group } from './groups';
import { CountrySchema } from './countries';
import { withPaginationEnvelope } from './@schema';

import type { UndefinedOnPartialDeep } from 'type-fest';
import type { PaginatedData, ListingParams } from './@types';
import type { SchemaInfer } from '@/utils/validation';

// ------------------------------------------------------
// -
// -    Schema / Enums
// -
// ------------------------------------------------------

/**
 * Modes d'affichage des événements.
 *
 * NOTE IMPORTANTE:
 * En cas de modif., pensez à aussi mettre à jour les constantes du modèle back-end.
 * {@see {@link /server/src/App/Models/User.php}}
 */
export enum BookingsViewMode {
    /** Vue en calendrier (timeline) */
    CALENDAR = 'calendar',

    /** Vue en liste. */
    LISTING = 'listing',
}

/**
 * Modes d'affichage de la page des techniciens.
 *
 * NOTE IMPORTANTE:
 * En cas de modif., pensez à aussi mettre à jour les constantes du modèle back-end.
 * {@see {@link /server/src/App/Models/User.php}}
 */
export enum TechniciansViewMode {
    /** Vue sous forme de timeline. */
    TIMELINE = 'timeline',

    /** Vue en liste. */
    LISTING = 'listing',
}

export const UserSummarySchema = z.strictObject({
    id: z.number(),
    full_name: z.string().nullable().transform(
        // NOTE: Le `?` ci-dessous n'est pas idéal et doit être évité dans la mesure
        //       du possible, mais étant donné qu'il est possible que la `person` lié
        //       ait été supprimée, on préfère utiliser `?` en fallback plutôt que de
        //       planter le retour.  Ceci n'est pas censé arriver mais le cas doit être
        //       géré, au cas où.
        (value: string | null) => value ?? '?',
    ),
    // TODO [zod@>3.22.4]: Remettre `email()`.
    email: z.string(),
});

export const UserSchema = UserSummarySchema.extend({
    pseudo: z.string(),
    first_name: z.string().nullable().transform(
        // NOTE: Le `?` ci-dessous n'est pas idéal et doit être évité dans la mesure
        //       du possible, mais étant donné qu'il est possible que la `person` lié
        //       ait été supprimée, on préfère utiliser `?` en fallback plutôt que de
        //       planter le retour.  Ceci n'est pas censé arriver mais le cas doit être
        //       géré, au cas où.
        (value: string | null) => value ?? '?',
    ),
    last_name: z.string().nullable().transform(
        // NOTE: Le `?` ci-dessous n'est pas idéal et doit être évité dans la mesure
        //       du possible, mais étant donné qu'il est possible que la `person` lié
        //       ait été supprimée, on préfère utiliser `?` en fallback plutôt que de
        //       planter le retour.  Ceci n'est pas censé arriver mais le cas doit être
        //       géré, au cas où.
        (value: string | null) => value ?? '?',
    ),
    phone: z.string().nullable(),
    group: z.nativeEnum(Group),
});

export const UserDetailsSchema = UserSchema.extend({
    street: z.string().nullable(),
    postal_code: z.string().nullable(),
    locality: z.string().nullable(),
    country_id: z.number().nullable(),
    country: z.lazy(() => CountrySchema).nullable(),
    full_address: z.string().nullable(),
});

export const UserSettingsSchema = z.strictObject({
    language: z.string(),
    default_bookings_view: z.nativeEnum(BookingsViewMode),
    default_technicians_view: z.nativeEnum(TechniciansViewMode),
    disable_contextual_popovers: z.boolean(),
    disable_search_persistence: z.boolean(),
});

// ------------------------------------------------------
// -
// -    Types
// -
// ------------------------------------------------------

export type UserSettings = SchemaInfer<typeof UserSettingsSchema>;

export type User = SchemaInfer<typeof UserSchema>;
export type UserSummary = SchemaInfer<typeof UserSummarySchema>;
export type UserDetails = SchemaInfer<typeof UserDetailsSchema>;

//
// - Edition
//

export type UserEdit = {
    first_name: string | null,
    last_name: string | null,
    pseudo: string,
    email: string,
    phone: string | null,
    password?: string,
    group: Group,
};

export type UserEditSelf = Omit<UserEdit, (
    | 'group'
)>;

export type UserSettingsEdit = Partial<UserSettings>;

//
// - Récupération
//

export type GetAllParams = (
    & ListingParams
    & UndefinedOnPartialDeep<{
        deleted?: boolean,
        group?: Group | null,
        notBeneficiaries?: boolean,
        notTechnicians?: boolean,
    }>
);

// ------------------------------------------------------
// -
// -    Fonctions
// -
// ------------------------------------------------------

const all = async (params: GetAllParams = {}): Promise<PaginatedData<User[]>> => {
    const response = await requester.get('/users', { params });
    return withPaginationEnvelope(UserSchema).parse(response);
};

const one = async (id: User['id'] | 'self'): Promise<UserDetails> => {
    const response = await requester.get(`/users/${id}`);
    return UserDetailsSchema.parse(response);
};

const create = async (data: UserEdit): Promise<UserDetails> => {
    const response = await requester.post('/users', data);
    return UserDetailsSchema.parse(response);
};

async function update(id: 'self', data: UserEditSelf): Promise<UserDetails>;
async function update(id: User['id'], data: UserEdit): Promise<UserDetails>;
async function update(id: User['id'] | 'self', data: UserEdit | UserEditSelf): Promise<UserDetails> {
    const response = await requester.put(`/users/${id}`, data);
    return UserDetailsSchema.parse(response);
}

const getSettings = async (id: User['id'] | 'self'): Promise<UserSettings> => {
    const response = await requester.get(`/users/${id}/settings`);
    return UserSettingsSchema.parse(response);
};

const updateSettings = async (id: User['id'] | 'self', data: UserSettingsEdit): Promise<UserSettings> => {
    const response = await requester.put(`/users/${id}/settings`, data);
    return UserSettingsSchema.parse(response);
};

const restore = async (id: User['id']): Promise<UserDetails> => {
    const response = await requester.put(`/users/restore/${id}`);
    return UserDetailsSchema.parse(response);
};

const remove = async (id: User['id']): Promise<void> => {
    await requester.delete(`/users/${id}`);
};

export default {
    all,
    one,
    create,
    update,
    getSettings,
    updateSettings,
    restore,
    remove,
};
