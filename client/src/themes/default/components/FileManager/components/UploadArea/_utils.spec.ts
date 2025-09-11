import config from '@/globals/config';
import { getFileError } from './_utils';

describe('getFileError', () => {
    it('returns null with a file OK', () => {
        const file = new File(['fakeContent'], 'test.txt', { type: 'text/plain' });
        expect(getFileError(file)).toBeNull();
    });

    it('returns null with an empty file', () => {
        const file = new File([], 'test.txt', { type: 'text/plain' });
        expect(getFileError(file)).toBeNull();
    });

    it('returns "type-not-allowed" with a file of not allowed type', () => {
        const file = new File(['fakeContent'], 'test.js', { type: 'text/javascript' });
        expect(getFileError(file)).toBe('type-not-allowed');
    });

    it('returns "size-exceeded" with a file that is too big', () => {
        const file = new File(['fakeContent', 'too big'], 'test.jpeg', { type: 'image/jpeg' });
        Object.defineProperty(file, 'size', { value: config.maxFileUploadSize + 1 });
        expect(getFileError(file)).toBe('size-exceeded');
    });
});
