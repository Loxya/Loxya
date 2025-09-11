import { fileURLToPath } from 'node:url';
import { defineConfig, globalIgnores } from 'eslint/config';
import vueConfig from '@pulsanova/eslint-config-vue';
import nodeConfig from '@pulsanova/eslint-config-node';
import nodeLegacyConfig from '@pulsanova/eslint-config-node/legacy';
import testExtension from './extensions/tests.js';

const resolve = (packagePath) => fileURLToPath(
    import.meta.resolve(packagePath),
);

const modernConfig = defineConfig([
    ...vueConfig,
    {
        languageOptions: {
            parserOptions: {
                babelOptions: {
                    configFile: resolve('@loxya/babel-config'),
                },
            },
            globals: {
                require: 'readonly',
                process: 'readonly',
            },
        },
        settings: {
            'import/resolver': {
                [resolve('eslint-import-resolver-webpack')]: {
                    config: resolve('@loxya/tasks/config/webpack'),
                },
            },
        },
    },
    {
        files: ['src/**/locale/**/*'],
        rules: {
            '@stylistic/quotes': ['off'],
        },
    },
    // - Autorise le `snake_case` dans les types d'API vu que pour le moment
    //   celle-ci accepte et retourne uniquement sous ce format.
    {
        files: [
            'src/**/stores/api/*.ts',
            'src/**/stores/api/**/*.ts',
            'src/**/tests/fixtures/**/*.ts',
        ],
        rules: {
            '@typescript-eslint/naming-convention': [
                'error',
                {
                    selector: 'enumMember',
                    format: ['UPPER_CASE'],
                },
                {
                    selector: ['typeProperty', 'typeMethod'],
                    format: ['camelCase', 'snake_case'],
                    leadingUnderscore: 'allow',
                    filter: {
                        // - Ignore les propriétés / méthodes de type "gettext" (= `__`).
                        regex: '^__$',
                        match: false,
                    },
                },
                {
                    selector: 'typeLike',
                    format: ['PascalCase'],
                },
            ],
        },
    },
    testExtension,
]);

export default defineConfig([
    globalIgnores([
        'dist/',
        'tests/coverage/',
    ]),

    //
    // - Configuration principale.
    //

    {
        name: '@loxya/source',
        files: ['**/*'],
        ignores: [
            'vendors/**',
            '!vendor/vis-timeline/**',
            '!vendor/polyfill/**',
            '**/babel.config.*',
            '**/eslint.config.*',
            '**/jest.config.*',
            '**/postcss.config.*',
            '**/stylelint.config.*',
            '**/vue.config.*',
        ],
        extends: [modernConfig],
    },

    //
    // - Outils / Fichiers de configuration.
    //

    {
        name: '@loxya/tools',
        files: [
            'vendors/**',
            '**/eslint.config.{js,mjs,ts,mts}',
            '**/stylelint.config.{js,mjs,ts,mts}',
        ],
        ignores: [
            'vendors/**/*.d.ts',
            'vendors/vis-timeline/**',
            'vendors/polyfill/**',
        ],
        extends: [nodeConfig],
    },
    {
        name: '@loxya/legacy-tools',
        files: [
            '**/babel.config.js',
            '**/jest.config.js',
            '**/postcss.config.js',
            '**/vue.config.js',
        ],
        extends: [nodeLegacyConfig],
    },
]);
