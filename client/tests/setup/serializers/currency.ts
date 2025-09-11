import Currency from '@/utils/currency';

export const test = (value: unknown): boolean => value instanceof Currency;

export const serialize = (value: Currency): string => (
    `/* Currency Instance => */ "${value.code}"`
);
