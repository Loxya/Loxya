import Decimal from 'decimal.js';

export const test = (value: unknown): boolean => value instanceof Decimal;

export const serialize = (value: Decimal): string => (
    `/* Decimal Instance => */ "${value.toString()}"`
);
