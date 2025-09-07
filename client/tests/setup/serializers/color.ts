import Color from '@/utils/color';

export const test = (value: unknown): boolean => value instanceof Color;

export const serialize = (value: Color): string => (
    `/* Color Instance => */ "${value.toString()}"`
);
