import core from 'zod';
import { markRaw } from 'vue';
import Decimal from 'decimal.js';
import invariant from 'invariant';
import Color from '@/utils/color';
import Period, { SerializedPeriodSchema } from '@/utils/period';
import DateTime from '@/utils/datetime';
import Currency from '@/utils/currency';
import Country from '@/utils/country';
import Phone from '@/utils/phone';
import Day from '@/utils/day';

import type { Raw } from 'vue';
import type { SerializedPeriod } from '@/utils/period';
import type { AnyZodObject, RefinementCtx, ZodRawShape, ZodUnion } from 'zod';

/**
 * Prise en charge d'une période sérialisée.
 *
 * @returns Un wrapper de validation d'une période "brute" (= sérialisée).
 *          La période ne sera pas transformée, elle restera "brute".
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const serializedPeriod = () => SerializedPeriodSchema;

/**
 * Prise en charge d'une période, qu'elle soit sous forme d'instance ou sérialisée.
 *
 * @returns Un wrapper de validation de période (sérialisée ou non).
 *          Le retour sera en instance de `Period`.
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const period = () => (
    core
        .union([serializedPeriod(), core.instanceof(Period)])
        .transform((value: Period | SerializedPeriod, ctx: RefinementCtx): Raw<Period> => {
            try {
                return markRaw(Period.from(value));
            } catch (error) {
                ctx.addIssue({
                    code: core.ZodIssueCode.custom,
                    params: {
                        code: 'invalid-period',
                        cause: error,
                    },
                });
                return core.NEVER;
            }
        })
);

/**
 * Prise en charge d'une date + heure, qu'elle soit sous forme d'instance ou sérialisée.
 *
 * @returns Un wrapper de validation de date + heure (sérialisée ou non).
 *          Le retour sera en instance de `DateTime`.
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const datetime = () => (
    core
        .union([core.string(), core.instanceof(DateTime)])
        .transform((value: string | DateTime, ctx: RefinementCtx): Raw<DateTime> => {
            try {
                return markRaw(new DateTime(value));
            } catch (error) {
                ctx.addIssue({
                    code: core.ZodIssueCode.custom,
                    params: {
                        code: 'invalid-datetime',
                        cause: error,
                    },
                });
                return core.NEVER;
            }
        })
);

/**
 * Prise en charge d'une date sans heure (= une journée), qu'elle soit sous forme d'instance ou sérialisée.
 *
 * @returns Un wrapper de validation de date sans heure (sérialisée ou non).
 *          Le retour sera en instance de `Day`.
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const day = () => (
    core
        .union([core.string(), core.instanceof(Day)])
        .transform((value: string | Day, ctx: RefinementCtx): Raw<Day> => {
            try {
                return markRaw(new Day(value));
            } catch (error) {
                ctx.addIssue({
                    code: core.ZodIssueCode.custom,
                    params: {
                        code: 'invalid-day',
                        cause: error,
                    },
                });
                return core.NEVER;
            }
        })
);

/**
 * Prise en charge d'une valeur décimale, qu'elle soit sous forme
 * d'instance, de nombre ou chaîne de caractère.
 *
 * @returns Un wrapper de validation de valeur décimale (instance, nombre ou chaîne de caractère).
 *          Le retour sera en instance de `Decimal`.
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const decimal = () => (
    core
        .union([
            core.string(),
            core.number(),
            core.instanceof(Decimal),
        ])
        .transform((value: string | number | Decimal, ctx: RefinementCtx): Raw<Decimal> => {
            try {
                return markRaw(new Decimal(value));
            } catch (error) {
                ctx.addIssue({
                    code: core.ZodIssueCode.custom,
                    params: {
                        code: 'invalid-decimal',
                        cause: error,
                    },
                });
                return core.NEVER;
            }
        })
);

/**
 * Prise en charge d'une devise, qu'elle soit sous forme d'instance ou sous forme de code ISO.
 *
 * @returns Un wrapper de validation de devise (instance ou chaîne de caractère).
 *          Le retour sera en instance de `Currency`.
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const currency = () => (
    core
        .union([core.string(), core.instanceof(Currency)])
        .transform((value: string | Currency, ctx: RefinementCtx): Raw<Currency> => {
            try {
                return markRaw(new Currency(value));
            } catch (error) {
                ctx.addIssue({
                    code: core.ZodIssueCode.custom,
                    params: {
                        code: 'invalid-currency',
                        cause: error,
                    },
                });
                return core.NEVER;
            }
        })
);

/**
 * Prise en charge d'un pays, qu'il soit sous forme d'instance ou sous forme de code ISO.
 *
 * @returns Un wrapper de validation de pays (instance ou chaîne de caractère).
 *          Le retour sera en instance de `Country`.
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const country = () => (
    core
        .union([core.string().length(2), core.instanceof(Country)])
        .transform((value: string | Country, ctx: RefinementCtx): Raw<Country> => {
            try {
                return markRaw(new Country(value));
            } catch (error) {
                ctx.addIssue({
                    code: core.ZodIssueCode.custom,
                    params: {
                        code: 'invalid-country',
                        cause: error,
                    },
                });
                return core.NEVER;
            }
        })
);

/**
 * Prise en charge d'un téléphone, qu'il soit sous forme d'instance ou sous
 * forme de code chaîne de caractères.
 *
 * @returns Un wrapper de validation de téléphone (instance ou chaîne de caractère).
 *          Le retour sera en instance de `Phone`.
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const phone = () => (
    core
        .union([core.string(), core.instanceof(Phone)])
        .transform((value: string | Phone, ctx: RefinementCtx): Raw<Phone> => {
            try {
                return markRaw(new Phone(value, { loose: true }));
            } catch (error) {
                ctx.addIssue({
                    code: core.ZodIssueCode.custom,
                    params: {
                        code: 'invalid-phone',
                        cause: error,
                    },
                });
                return core.NEVER;
            }
        })
);

/**
 * Prise en charge d'une couleur, qu'elle soit sous forme d'instance ou sous forme de chaîne de caractères.
 *
 * @returns Un wrapper de validation de couleur (instance ou chaîne de caractère).
 *          Le retour sera en instance de `Color`.
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const color = () => (
    core
        .union([core.string(), core.instanceof(Color)])
        .transform((value: string | Color, ctx: RefinementCtx): Raw<Color> => {
            let error: unknown | undefined;
            try {
                if (Color.isValid(value)) {
                    return markRaw(new Color(value));
                }
            } catch (_error) {
                error = _error;
            }

            ctx.addIssue({
                code: core.ZodIssueCode.custom,
                params: {
                    code: 'invalid-color',
                    cause: error ?? 'Invalid color string.',
                },
            });

            return core.NEVER;
        })
);

/**
 * Prise en charge d'une adresse email.
 *
 * @returns Un wrapper de validation d'une adresse email.
 *          Le retour sera une chaîne de caractères.
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const email = () => (
    // TODO [zod@>3.22.4]: Remettre `email()`.
    core.string()
);

/**
 * Prise en charge des valeurs string-like (e.g. 74000 => "74000").
 *
 * @returns Un wrapper de validation de valeur string-like.
 *          Le retour sera une chaîne de caractères.
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const stringLike = () => (
    core
        .union([core.string(), core.number()])
        .transform(String)
);

/**
 * Créé un schéma littéral avec une valeur par défaut identique.
 *
 * @param value - La valeur littérale à utiliser comme type et comme valeur par défaut.
 *
 * @returns Un wrapper de validation littéral avec valeur par défaut.
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const constant = <T extends NonNullable<core.Primitive>>(value: T) => (
    core.literal(value).default(value)
);

/**
 * Prise en charge des valeurs number-like (e.g. "1" => 1).
 *
 * @returns Un wrapper de validation de valeur number-like.
 *          Le retour sera un nombre.
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const numberLike = () => (
    core
        .union([core.number(), core.string()])
        .transform((value: number | string, ctx: RefinementCtx): number => {
            const parsed = Number(value);
            if (Number.isNaN(parsed)) {
                ctx.addIssue({
                    code: core.ZodIssueCode.custom,
                    params: {
                        code: 'invalid-number',
                        cause: 'Invalid number-like.',
                    },
                });

                return core.NEVER;
            }
            return parsed;
        })
);

// ------------------------------------------------------
// -
// -    Surcharge de `.extend()`
// -
// ------------------------------------------------------

((originalExtend: (this: AnyZodObject, augmentation: ZodRawShape) => AnyZodObject) => {
    // @ts-expect-error -- L'implémentation ne peut pas refléter le type générique conditionnel.
    core.ZodObject.prototype.extend = function extend(this: AnyZodObject, ...variants: ZodRawShape[]) {
        if (variants.length <= 1) {
            return originalExtend.call(this, variants[0] ?? {});
        }

        const schemas = variants.map((variant) => (
            originalExtend.call(this, variant)
        ));

        const [first, second, ...rest] = schemas;
        return core.union([first, second, ...rest]);
    };

    // @ts-expect-error -- L'implémentation ne peut pas refléter le type générique conditionnel.
    core.ZodUnion.prototype.extend = function extend(this: ZodUnion<any>, ...variants: ZodRawShape[]) {
        const schemas = this.options.flatMap((base: core.ZodTypeAny) => {
            invariant(base instanceof core.ZodObject, '`.extend()` can only be used on a union of `ZodObject`.');
            return variants.map((variant) => originalExtend.call(base, variant));
        });

        const [first, second, ...rest] = schemas;
        return core.union([first!, second!, ...rest]);
    };
})(core.ZodObject.prototype.extend);

// ------------------------------------------------------
// -
// -    Exports
// -
// ------------------------------------------------------

export type {
    infer as SchemaInfer,
    output as SchemaOutput,
    input as SchemaInput,
    ZodType as SchemaType,
} from 'zod';

export const z = {
    ...core,
    decimal,
    period,
    datetime,
    day,
    email,
    currency,
    color,
    country,
    phone,
    stringLike,
    numberLike,
    constant,
};
