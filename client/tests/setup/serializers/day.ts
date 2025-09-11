import Day from '@/utils/day';

export const test = (value: unknown): boolean => value instanceof Day;

export const serialize = (value: Day): string => (
    `/* Day Instance => */ "${value.toString()}"`
);
