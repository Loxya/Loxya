import Period from '@/utils/period';

type Config = Record<string, any>;
type Refs = unknown[];
type Printer = (
    val: unknown,
    config: Config,
    indentation: string,
    depth: number,
    refs: Refs,
    hasCalledToJSON?: boolean,
) => string;

export const test = (value: unknown): boolean => value instanceof Period;

export const serialize = (
    value: Period,
    config: Config,
    indentation: string,
    depth: number,
    refs: Refs,
    printer: Printer,
): string => (
    `/* Period Instance => */ ${printer(value.toJSON(), config, indentation, depth, refs, true)}`
);
