import DateTime from '@/utils/datetime';

export const test = (value: unknown): boolean => value instanceof DateTime;

export const serialize = (value: DateTime): string => (
    `/* DateTime Instance => */ "${value.toString()}"`
);
