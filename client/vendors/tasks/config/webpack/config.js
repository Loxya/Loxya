import * as sass from 'sass';
import postcss from 'postcss';
import webpack from 'webpack';
import path from 'node:path';
import isSubDir from 'is-subdir';
import { fileURLToPath } from 'node:url';
import { builtinModules as nodeBuiltIns } from 'node:module';
import getWebpackEntries from '../../utils/getWebpackEntries.js';
import postcssConfig from '../postcss.js';
import cssnanoConfig from '../cssnano.js';
import conf from '../index.js';

// - Webpack plugins
import TerserPlugin from 'terser-webpack-plugin';
import { VueLoaderPlugin } from 'vue-loader';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import CssMinimizerPlugin from 'css-minimizer-webpack-plugin';
import CaseSensitivePathsPlugin from 'case-sensitive-paths-webpack-plugin';

const resolve = (packagePath) => fileURLToPath(
    import.meta.resolve(packagePath),
);

const IS_WINDOWS = process.platform === 'win32';

export default (env, options = {}) => {
    options = { hmr: false, ...options };

    const isProd = env === 'production';
    const isDev = env === 'development';

    const entry = getWebpackEntries(conf.sourcePath);
    const config = {
        entry,
        context: conf.rootPath,
        target: ['web', 'es5'],
        output: {
            path: conf.destinationPath,
            pathinfo: isDev,
            hashFunction: 'xxhash64',
            filename: 'js/[name].js',
            assetModuleFilename: `media/[name]${isProd ? '.[hash:8]' : ''}[ext]`,
            chunkFilename: `js/chunks/[name]${isProd ? '.[chunkhash]' : ''}.js`,
            publicPath: conf.publicPath,

            devtoolModuleFilenameTemplate(info) {
                let _path = path.resolve(info.absoluteResourcePath);
                if (!isDev) {
                    _path = path.relative(conf.sourcePath, _path);
                }
                return _path.replaceAll('\\', '/');
            },
        },
        externals: ({ context, request }, callback) => {
            // - Si un module tiers essaie d'importer un module natif de Node, on "neutralise" l'import.
            //   (même si un module tiers importe un module Node en vérifiant, par exemple, l'existence
            //   de `process` avant de le faire (ex. : `process !== undefined && require('path')`),
            //   Webpack tentera malgré tout d'inclure le module Node dans le bundle final car il ne
            //   prend pas en compte la condition d'exécution ; on s'assure donc qu'il n'essaye pas
            //   d'inclure ce module).
            // @see https://github.com/webpack/webpack/issues/8826
            // TODO : Utiliser `module.rules.[Règle des modules Node].resolve.fallback: { [Modules natifs]: false }`
            //        lorsque le problème suivant sera résolu : https://github.com/webpack/webpack/issues/14166
            if (isSubDir(conf.nodeModulesPath, context) && request.startsWith('node:')) {
                // @see https://github.com/webpack/webpack/issues/14166#issuecomment-953942617
                callback(null, '{}');
                return;
            }

            callback();
        },
        module: {
            noParse: /^(?:vue|vue-router|vuex|vuex-router-sync)$/,
            rules: [
                {
                    test: /\.(?:js|mjs|cjs|jsx|ts|mts|cts|tsx)$/,
                    resolve: {
                        fullySpecified: false,
                    },
                },
                {
                    test: /\.vue$/,
                    use: [
                        {
                            loader: resolve('vue-loader'),
                            options: {
                                compilerOptions: {
                                    whitespace: 'condense',
                                },
                            },
                        },
                    ],
                },
                {
                    oneOf: [
                        {
                            test: /\.(?:js|jsx|ts|tsx)$/,
                            include: conf.sourcePath,
                            loader: resolve('babel-loader'),
                            options: {
                                babelrc: false,
                                configFile: false,
                                highlightCode: isDev,
                                generatorOpts: {
                                    comments: false,
                                    compact: isProd,
                                    jsescOption: {
                                        quotes: 'single',
                                        indent: '  ',
                                    },
                                },
                                presets: [[
                                    resolve('@loxya/babel-config'),
                                ]],

                                // - Build cache.
                                cacheDirectory: path.join(conf.cachePath, 'babel'),
                                cacheCompression: false,
                            },
                        },
                        {
                            test: /\.(?:js|cjs|mjs)$/,
                            exclude: (() => {
                                const ignoredDependencies = [
                                    'core-js',
                                    'webpack',
                                    '@babel/runtime',
                                    'css-loader',
                                    'mini-css-extract-plugin',
                                    'regenerator-runtime/runtime',
                                ];

                                return ignoredDependencies.map((dependency) => {
                                    const depPath = path.join('node_modules', dependency, '/');
                                    return new RegExp(IS_WINDOWS ? depPath.replaceAll('\\', '\\\\') : depPath);
                                });
                            })(),
                            loader: resolve('babel-loader'),
                            type: 'javascript/auto',
                            options: {
                                babelrc: false,
                                configFile: false,
                                generatorOpts: {
                                    compact: false,
                                },
                                presets: [[
                                    resolve('@loxya/babel-config/dependencies'),
                                ]],

                                // - Build cache.
                                cacheDirectory: path.join(conf.cachePath, 'babel'),
                                cacheCompression: false,
                            },
                        },
                        {
                            test: /\.css/,
                            use: [
                                {
                                    loader: MiniCssExtractPlugin.loader,
                                    options: {
                                        publicPath: conf.publicPath,
                                    },
                                },
                                {
                                    loader: resolve('css-loader'),
                                    options: {
                                        importLoaders: 1,
                                        sourceMap: isDev,
                                        modules: false,
                                    },
                                },
                                {
                                    loader: resolve('postcss-loader'),
                                    options: {
                                        sourceMap: isDev,
                                        implementation: postcss,
                                        postcssOptions: () => ({
                                            config: false,
                                            plugins: postcssConfig({
                                                optimize: false,
                                            }),
                                        }),
                                    },
                                },
                            ],
                        },
                        {
                            test: /\.scss/,
                            use: [
                                {
                                    loader: MiniCssExtractPlugin.loader,
                                    options: {
                                        publicPath: conf.publicPath,
                                    },
                                },
                                {
                                    loader: resolve('css-loader'),
                                    options: {
                                        importLoaders: 3,
                                        sourceMap: isDev,
                                        modules: false,
                                    },
                                },
                                {
                                    loader: resolve('postcss-loader'),
                                    options: {
                                        sourceMap: isDev,
                                        implementation: postcss,
                                        postcssOptions: () => ({
                                            config: false,
                                            plugins: postcssConfig({
                                                optimize: false,
                                            }),
                                        }),
                                    },
                                },
                                {
                                    loader: resolve('resolve-url-loader'),
                                    options: { sourceMap: isDev },
                                },
                                {
                                    loader: resolve('sass-loader'),
                                    options: {
                                        sourceMap: true,
                                        implementation: sass,
                                        sassOptions: {
                                            quietDeps: true,
                                            style: 'expanded',
                                            silenceDeprecations: ['import'],
                                        },
                                    },
                                },
                            ],
                            // See https://github.com/webpack/webpack/issues/6571
                            sideEffects: true,
                        },
                        {
                            test: /\.svg(?:\?.*)?$/,
                            exclude: [
                                /(?:\/|\\{1,2})@fortawesome(?:\/|\\{1,2})fontawesome/,
                            ],
                            oneOf: [
                                {
                                    resourceQuery: /inline/,
                                    use: [
                                        { loader: resolve('vue-loader') },
                                        {
                                            loader: resolve('vue-svg-loader-2'),
                                            options: { svgo: false },
                                        },
                                    ],
                                },
                                {
                                    type: 'asset/resource',
                                    generator: {
                                        filename: `img/[name]${isProd ? '.[hash:8]' : ''}[ext]`,
                                    },
                                },
                            ],
                        },
                        {
                            test: /\.ya?ml(?:\?.*)?$/,
                            type: 'json',
                            loader: resolve('yaml-loader'),
                            options: { asJSON: true },
                        },
                        {
                            test: /\.(?:png|jpg|gif|jpeg|bmp|webp|avif)(?:\?.*)?$/,
                            type: 'asset/resource',
                            exclude: conf.nodeModulesPath,
                            generator: {
                                filename: `img/[name]${isProd ? '.[hash:8]' : ''}[ext]`,
                            },
                        },
                        {
                            test: /\.(?:mp4|webm|ogg|mp3|wav|flac|aac)(?:\?.*)?$/,
                            type: 'asset/resource',
                            generator: {
                                filename: `media/[name]${isProd ? '.[hash:8]' : ''}[ext]`,
                            },
                        },
                        {
                            test: /\.(?:woff2?|eot|ttf|otf)(?:\?.*)?$/i,
                            type: 'asset/resource',
                            generator: {
                                filename: `fonts/[name]${isProd ? '.[hash:8]' : ''}[ext]`,
                            },
                        },
                        {
                            test: /\.svg(?:\?.*)?(?:#.*)?$/i,
                            include: [
                                /(?:\/|\\{1,2})@fortawesome(?:\/|\\{1,2})fontawesome/,
                            ],
                            type: 'asset/resource',
                            generator: {
                                filename: `fonts/[name]${isProd ? '.[hash:8]' : ''}[ext]`,
                            },
                        },

                        // - Fallbacks
                        {
                            loader: resolve('file-loader'),
                            exclude: [/\.(?:js|mjs|cjs|ts|mts|cts|tsx)$/, /\.html$/, /\.json$/],
                            include: conf.nodeModulesPath,
                            type: 'javascript/auto',
                            options: {
                                regExp: '/node_modules/(.*)',
                                name: 'vendors/[1]',
                            },
                        },
                        {
                            exclude: [/\.(?:js|mjs|cjs|ts|mts|cts|tsx)$/, /\.html$/, /\.json$/],
                            type: 'asset/resource',
                        },

                        // ** STOP ** Vous ajoutez un nouveau loader ?
                        // Assurez-vous d'ajouter le(s) nouveau(x) loader(s) avant le loader "file".
                    ],
                },
            ],
            strictExportPresence: true,
        },
        resolve: {
            modules: ['node_modules', conf.nodeModulesPath],
            extensions: [
                '.mjs',
                '.cjs',
                '.js',
                '.mts',
                '.cts',
                '.ts',
                '.tsx',
                '.json',
            ],
            extensionAlias: {
                '.js': ['.ts', '.js'],
                '.mjs': ['.mts', '.mjs'],
                '.cjs': ['.cts', '.mjs'],
            },
            byDependency: {
                sass: {
                    mainFields: ['style', 'main'],
                    mainFiles: ['index', 'style'],
                },
            },
            fallback: {
                ...nodeBuiltIns.reduce(
                    // - Le format `node:*` est actuellement géré par `externals` ci-dessus, à déplacer ici
                    //   lorsque le problème suivant sera résolu : https://github.com/webpack/webpack/issues/14166
                    (acc, builtIn) => ({ ...acc, [builtIn]: false }),
                    {},
                ),
            },
            alias: {
                '@': conf.sourcePath,
                'vue$': 'vue/dist/vue.esm.js',
            },
        },
        plugins: [
            new VueLoaderPlugin(),
            new webpack.DefinePlugin({
                'process.env.NODE_ENV': JSON.stringify(env),
            }),
            new MiniCssExtractPlugin({
                filename: 'css/[name].css',
                chunkFilename: `css/chunks/[id]${isProd ? '.[chunkhash]' : ''}.css`,
            }),
            new CssMinimizerPlugin({
                parallel: true,
                minimizerOptions: cssnanoConfig(isProd),
            }),
        ],
        optimization: {
            minimize: isProd,
            usedExports: true,
            runtimeChunk: {
                name: '@commons',
            },
            splitChunks: {
                automaticNameDelimiter: '-',
                cacheGroups: {
                    default: false,
                    defaultVendors: false,
                    commons: {
                        name: '@commons',
                        test: /\.(?:js|jsx|mjs|cts|ts|tsx|mts|cts|json)$/,
                        minChunks: 2,
                        chunks: 'initial',
                        enforce: true,
                    },
                },
            },
            minimizer: [
                new TerserPlugin({
                    terserOptions: {
                        compress: {
                            arrows: false,
                            collapse_vars: false,
                            comparisons: false,
                            computed_props: false,
                            hoist_funs: false,
                            hoist_props: false,
                            hoist_vars: false,
                            inline: false,
                            loops: false,
                            negate_iife: false,
                            properties: false,
                            reduce_funcs: false,
                            reduce_vars: false,
                            switches: false,
                            toplevel: false,
                            typeofs: false,
                            booleans: true,
                            if_return: true,
                            sequences: true,
                            unused: true,
                            conditionals: true,
                            dead_code: true,
                            evaluate: true,
                        },
                        mangle: {
                            safari10: true,
                        },
                        format: {
                            comments: 'some',

                            // - Turned on because emoji and regex is not minified properly using default
                            // https://github.com/facebook/create-react-app/issues/2488
                            ascii_only: true,
                        },
                    },
                    parallel: true,
                    extractComments: false,
                }),
            ],
        },
        stats: 'none',
        bail: isProd,
        mode: isProd ? 'production' : 'development',
        devtool: isDev ? 'source-map' : false,
        performance: { hints: false },
        infrastructureLogging: {
            level: 'none',
        },
        cache: {
            type: 'filesystem',
            cacheDirectory: path.join(conf.cachePath, 'webpack'),
            buildDependencies: { config: [import.meta.filename] },
        },
    };

    if (isDev) {
        config.plugins.push(new CaseSensitivePathsPlugin());
    }

    if (options.hmr) {
        config.plugins.push(
            new webpack.HotModuleReplacementPlugin({
                requestTimeout: 30_000,
            }),
        );
    }

    return config;
};
