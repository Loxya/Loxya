import type {
    ZodObject,
    ZodTypeAny,
    ZodRawShape,
    AnyZodObject,
    UnknownKeysParam,
} from 'zod';

type ExtendShape<A extends ZodRawShape, B extends ZodRawShape> = {
    [K in keyof A | keyof B]: K extends keyof B ? B[K] : K extends keyof A ? A[K] : never;
};

type ExtendWith<S extends AnyZodObject, V extends ZodRawShape> =
    S extends ZodObject<infer Shape extends ZodRawShape, infer UK, infer C>
        ? ZodObject<ExtendShape<Shape, V>, UK, C>
        : never;

type ApplyVariants<S extends AnyZodObject, V extends readonly ZodRawShape[]> =
    V extends readonly [infer First extends ZodRawShape, ...infer Rest extends ZodRawShape[]]
        ? [ExtendWith<S, First>, ...ApplyVariants<S, Rest>]
        : [];

type DistributeVariants<Members extends readonly AnyZodObject[], V extends readonly ZodRawShape[]> =
    Members extends readonly [infer First extends AnyZodObject, ...infer Rest extends AnyZodObject[]]
        ? [...ApplyVariants<First, V>, ...DistributeVariants<Rest, V>]
        : [];

declare module 'zod' {
    interface ZodObject<T extends ZodRawShape, UnknownKeys extends UnknownKeysParam, Catchall extends ZodTypeAny> {
        extend<V extends [ZodRawShape, ZodRawShape, ...ZodRawShape[]]>(...variants: V): (
            ApplyVariants<ZodObject<T, UnknownKeys, Catchall>, V> extends
            infer R extends [ZodTypeAny, ZodTypeAny, ...ZodTypeAny[]]
                ? ZodUnion<R>
                : never
        );
    }

    interface ZodUnion<T extends Readonly<[ZodTypeAny, ...ZodTypeAny[]]>> {
        extend<V extends [ZodRawShape, ...ZodRawShape[]]>(...variants: V): (
            DistributeVariants<
                T extends readonly AnyZodObject[] ? T : never,
                V
            > extends infer R extends [ZodTypeAny, ZodTypeAny, ...ZodTypeAny[]]
                ? ZodUnion<R>
                : never
        );
    }
}
