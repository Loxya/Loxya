import Country from '@/utils/country';

export const test = (value: unknown): boolean => value instanceof Country;

export const serialize = (value: Country): string => (
    `/* Country Instance => */ "${value.code}"`
);
