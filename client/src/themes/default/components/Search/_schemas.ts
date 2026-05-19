import { z } from '@/utils/validation';
import { TERM_TOKEN_TYPE, TokenKind } from './_constants';

import type { ZodRawShape } from 'zod';

export const TokenValueSchema = z.union([
    z.string(),
    z.number(),
    z.array(z.union([z.string(), z.number()])),
    z.boolean(),
    z.period(),
    z.day(),
]);

export const TokenOperatorValueSchema = z.string();

const CustomTokenSchema = z.strictObject({
    id: z.union([z.string(), z.number()]),
    type: z.string(),
    operator: TokenOperatorValueSchema.nullable(),
    value: TokenValueSchema,
});

const RawCustomTokenSchema = CustomTokenSchema
    .omit({ id: true, operator: true })
    .extend({ operator: TokenOperatorValueSchema.optional() });

export const RawTokenSchema = z.union([
    RawCustomTokenSchema,
    z.string(),
]);

const TokenOperatorSchema = z.strictObject({
    label: z.string(),
    alias: z.string().optional(),
    value: TokenOperatorValueSchema,
});

export const OptionSchema = z.strictObject({
    icon: z.union([z.string(), z.undefined()]).optional(),
    label: z.string(),
    value: z.union([
        z.string(),
        z.number(),
        z.literal(TERM_TOKEN_TYPE),
        z.boolean(),
    ]),
    default: z.boolean().optional(),
    data: z.unknown().optional(),
});

const TokenOptionSchema = OptionSchema
    .omit({ value: true })
    .extend({
        value: z.union([z.string(), z.number()]),
    });

const TokenDefinitionBaseSchema = z.strictObject({
    type: z.string(),
    icon: z.string().optional(),
    title: z.string(),
    operators: z.array(TokenOperatorSchema).optional(),
    unique: z.boolean().optional(),
    disabled: z.boolean().optional(),
    render: z.function().args(z.any()).optional(),
});

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const createTokenDefinitionSchema = <T extends ZodRawShape>(augmentation: T) => {
    const baseSchema = TokenDefinitionBaseSchema
        .extend<T>(augmentation);

    return z.union([
        baseSchema.extend({
            kind: z.union([
                z.literal(TokenKind.TEXT),
                z.literal(TokenKind.DATE),
                z.literal(TokenKind.PERIOD),
                z.literal(TokenKind.BOOLEAN),
                z.literal(TokenKind.INTEGER),
                z.literal(TokenKind.FLOAT),
            ]),
        }),
        baseSchema.extend({
            kind: z.literal(TokenKind.LIST).optional(),
            options: z.array(TokenOptionSchema),
            multiSelect: z.boolean().optional(),
        }),
    ]);
};

export const TokenDefinitionSchema = createTokenDefinitionSchema({});
