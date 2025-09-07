import type { UnionToTuple } from 'type-fest';

// @see https://github.com/sindresorhus/type-fest/issues/819
// @see https://github.com/colinhacks/zod/blob/v3.22.4/src/helpers/enumUtil.ts
type CastToStringTuple<T> = T extends [string, ...string[]] ? T : never;
export type UnionToTupleString<T> = CastToStringTuple<UnionToTuple<T>>;
