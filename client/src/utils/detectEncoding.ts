import { detect as detectEncodingRaw } from 'jschardet';

/* eslint-disable unicorn/text-encoding-identifier-case */
const ALLOWED_ENCODINGS = [
    'UTF-8',
    'UTF-32LE',
    'UTF-32BE',
    'UTF-16LE',
    'UTF-16BE',
    'ISO-2022-JP',
    'ISO-2022-KR',
    'UTF-8',
    'EUC-JP',
    'EUC-KR',
    'Big5',
    'EUC-TW',
    'KOI8-R',
    'ISO-8859-2',
    'ISO-8859-5',
    'ISO-8859-7',
    'ISO-8859-5',
    'windows-1251',
    'windows-1252',
];
/* eslint-enable unicorn/text-encoding-identifier-case */

const detectEncoding = (file: File): Promise<string | null> => (
    new Promise((resolve) => {
        const reader = new FileReader();

        reader.onerror = () => {
            resolve(null);
        };

        reader.onload = () => {
            const arrayBuffer = reader.result as ArrayBuffer;
            const uint8Array = new Uint8Array(arrayBuffer);
            const binaryString = String.fromCharCode.apply(null, (uint8Array as any) as number[]);

            try {
                const { encoding } = detectEncodingRaw(binaryString, {
                    detectEncodings: ALLOWED_ENCODINGS,
                    minimumThreshold: 0.8,
                });
                resolve(encoding ?? null);
            } catch {
                resolve(null);
            }
        };

        reader.readAsArrayBuffer(file);
    })
);

export default detectEncoding;
