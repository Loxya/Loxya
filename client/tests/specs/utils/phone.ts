import Phone from '@/utils/phone';

describe('Utils / Phone', () => {
    describe('number', () => {
        it('return the number with E.164 format', () => {
            expect(new Phone('0123456789').number).toBe('+33123456789');
            expect(new Phone('+330623456789').number).toBe('+33623456789');
            expect(new Phone('+33623456789').number).toBe('+33623456789');
        });

        it('return wrong number with original value in loose mode', () => {
            expect(() => new Phone('092992').number).toThrow();
            expect(new Phone('092992', { loose: true }).number).toBe('092992');
        });
    });
});
