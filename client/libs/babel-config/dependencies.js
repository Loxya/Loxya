import path from 'node:path';
import { fileURLToPath } from 'node:url';
import babelPresetEnv from '@babel/preset-env';
import babelPluginTransformRuntime from '@babel/plugin-transform-runtime';
import browserslistConfig from '@loxya/browserslist-config';

const resolve = (packagePath) => fileURLToPath(
    import.meta.resolve(packagePath),
);

export default (api, options = {}) => {
    const env = process.env.BABEL_ENV ?? process.env.NODE_ENV ?? 'development';
    api.cache(() => env);

    const usePolyfillsReferences = !!(options.usePolyfillsReferences ?? true);
    const useHelpersReferences = !!(options.useHelpersReferences ?? true);

    const presets = [];
    if (env === 'test') {
        presets.push([
            babelPresetEnv,
            { targets: { node: 'current' } },
        ]);
    } else {
        presets.push([
            babelPresetEnv,
            {
                bugfixes: true,
                targets: browserslistConfig,
                ignoreBrowserslistConfig: true,
                useBuiltIns: usePolyfillsReferences ? 'entry' : false,
                corejs: usePolyfillsReferences ? '3.45' : undefined,
            },
        ]);
    }

    return {
        presets,
        sourceType: 'unambiguous',
        plugins: [
            [
                babelPluginTransformRuntime,
                {
                    helpers: useHelpersReferences,
                    regenerator: usePolyfillsReferences,
                    absoluteRuntime: path.dirname(
                        resolve('@babel/runtime/package.json'),
                    ),
                },
            ],
        ],
    };
};
