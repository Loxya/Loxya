import formatBytes from '@/utils/formatBytes';

describe('formatBytes', () => {
    it('returns 0 Bytes when 0', () => {
        expect(formatBytes(0)).toBe('0 Bytes');
    });

    it('returns the size in bytes', () => {
        expect(formatBytes(100)).toBe('100 Bytes');
        expect(formatBytes(1000)).toBe('1000 Bytes');
    });

    it('returns the size in kilobytes', () => {
        expect(formatBytes(1024)).toBe('1 KB');
        expect(formatBytes(1148)).toBe('1.1 KB');
        expect(formatBytes(1_048_575)).toBe('1024 KB');
    });

    it('returns the size in megabytes', () => {
        expect(formatBytes(1_048_576)).toBe('1 MB');
        expect(formatBytes(1_500_000)).toBe('1.4 MB');
        expect(formatBytes(1_073_741_823)).toBe('1024 MB');
    });

    it('returns the size in gigabytes', () => {
        expect(formatBytes(1_073_741_824)).toBe('1 GB');
        expect(formatBytes(1_099_511_627_770)).toBe('1024 GB');
    });

    it('returns the size in terabytes', () => {
        expect(formatBytes(1_099_511_627_780)).toBe('1 TB');
    });
});
