import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import conf from '../index.js';

const resolve = (packagePath) => fileURLToPath(
    import.meta.resolve(packagePath),
);

export default () => {
    process.env.TZ = 'UTC';

    // - Serializers.
    const serializersFiles = [];
    const serializersDir = path.resolve(conf.rootPath, 'tests/setup/serializers/');
    if (fs.existsSync(serializersDir)) {
        fs.readdirSync(serializersDir).forEach((file) => {
            if (fs.statSync(path.join(serializersDir, file)).isFile()) {
                serializersFiles.push(`<rootDir>/tests/setup/serializers/${file}`);
            }
        });
    }

    return {
        rootDir: conf.rootPath,
        collectCoverageFrom: [
            'src/**/*.{js,ts}',
            '!src/**/{layouts,components,modals,pages}/**/index.js',
            '!src/**/themes/*/index.js',
            '!src/**/{globals,locale}/**/*',
            '!src/**/*.d.ts',
        ],
        coverageDirectory: '<rootDir>/tests/coverage',
        coverageReporters: ['lcov', 'html', 'text-summary'],
        setupFilesAfterEnv: ['<rootDir>/tests/setup/index.ts'],
        setupFiles: [resolve('@loxya/polyfill')],
        testMatch: [
            '<rootDir>/tests/specs/**/*.{js,ts,tsx}',
            '<rootDir>/src/**/__tests__/**/*.{js,ts,tsx}',
            '<rootDir>/src/**/?(*.)spec.{js,ts,tsx}',
        ],
        testPathIgnorePatterns: ['/node_modules/'],
        testEnvironment: 'jsdom',
        transform: {
            '^.+\\.(js|mjs|cjs|jsx|ts|mts|cts|tsx)$': resolve('./transforms/babel.js'),
            '^.+\\.scss$': resolve('./transforms/css.js'),
            '^(?!.*\\.(js|mjs|cjs|ts|mts|cts|tsx|scss|json)$)': resolve('./transforms/file.js'),
        },
        transformIgnorePatterns: ['[/\\\\]node_modules[/\\\\].+\\.(js|cts|mjs|ts|cts|mts|tsx)$'],
        moduleDirectories: ['node_modules', conf.nodeModulesPath],
        moduleFileExtensions: ['js', 'mjs', 'cjs', 'ts', 'tsx', 'mts', 'cts', 'json'],
        moduleNameMapper: {
            '^@/(.*)$': '<rootDir>/src/$1',
            '^@fixtures/(.*)$': '<rootDir>/tests/fixtures/$1',
        },
        snapshotSerializers: serializersFiles,
        watchPlugins: [
            'jest-watch-typeahead/filename',
            'jest-watch-typeahead/testname',
        ],
        resetMocks: true,
    };
};
