import path from 'node:path';
import { fileURLToPath } from 'node:url';
import babelPresetEnv from '@babel/preset-env';
import babelPresetJsx from '@vue/babel-preset-jsx';
import babelPluginProposalDecorator from '@babel/plugin-proposal-decorators';
import babelPluginTransformRuntime from '@babel/plugin-transform-runtime';
import babelPresetTypescript from '@babel/preset-typescript';
import browserslistConfig from '@loxya/browserslist-config';

const resolve = (packagePath) => fileURLToPath(
    import.meta.resolve(packagePath),
);

export default (api) => {
    const env = process.env.BABEL_ENV ?? process.env.NODE_ENV ?? 'development';
    api.cache(() => env);

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
                useBuiltIns: 'entry',
                corejs: '3.45',
            },
        ]);
    }
    presets.push(
        [babelPresetJsx],
        [
            babelPresetTypescript,
            { optimizeConstEnums: true },
        ],
    );

    const plugins = [
        [
            babelPluginProposalDecorator,
            { version: '2023-11' },
        ],
        [
            babelPluginTransformRuntime,
            {
                helpers: true,
                regenerator: true,
                absoluteRuntime: path.dirname(
                    resolve('@babel/runtime/package.json'),
                ),
            },
        ],
    ];

    return { presets, plugins };
};
