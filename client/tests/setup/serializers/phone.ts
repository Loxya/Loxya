import Phone from '@/utils/phone';

export const test = (value: unknown): boolean => value instanceof Phone;

export const serialize = (value: Phone): string => (
    `/* Phone Instance => */ "${value.number}"`
);
