import webpack from 'webpack';
import colors from 'picocolors';
import { rimrafSync } from 'rimraf';
import supportsColor from 'supports-color';
import webpackConfig from '../config/webpack/config.js';
import conf from '../config/index.js';

const executor = (options) => {
    const env = options.production ? 'production' : 'development';
    const shouldWatch = options.watch;

    process.env.BABEL_ENV = env;
    process.env.NODE_ENV = env;

    // - Supprime le précédent build.
    rimrafSync(conf.destinationPath);

    const config = webpackConfig(env);
    const compiler = webpack(config);
    if (!options.silent) {
        (new webpack.ProgressPlugin()).apply(compiler);
    }

    let lastHash = null;
    const compilerCallback = (err, stats) => {
        if (!shouldWatch || err) {
            compiler.purgeInputFileSystem();
        }

        if (err) {
            lastHash = null;
            console.error(`${colors.red(err)}\n\n`);
            process.exit(1);
            return;
        }

        if (stats.hash !== lastHash) {
            lastHash = stats.hash;

            const baseStatsOptions = {
                context: process.cwd(),
                colors: supportsColor,
                errorDetails: true,
                errorStack: false,
            };

            if (!shouldWatch && stats.hasErrors()) {
                const statsString = stats.toString({
                    ...baseStatsOptions,
                    all: false,
                    errors: true,
                    warnings: true,
                });
                console.error(`${colors.red(statsString)}\n\n`);
                process.exit(1);
                return;
            }

            const statsOptions = {
                ...baseStatsOptions,
                entrypoints: false,
                modules: false,
                cachedModules: false,
                cachedAssets: false,
                hash: false,
                version: false,
                timings: false,
                chunks: false,
                chunkModules: false,
                children: true,
                assetsSort: 'name',
                groupAssetsByPath: false,
                groupAssetsByInfo: false,
                groupAssetsByChunk: false,
                groupAssetsByExtension: false,
                groupAssetsByEmitStatus: false,
                excludeAssets: [/\.map$/],
                exclude: ['node_modules'],
                assetsSpace: Infinity,
            };
            const statsString = stats.toString(
                options.silent ? { all: false } : statsOptions,
            );

            if (statsString) {
                console.log(`Résultat du build :\n${statsString}\n`);
            }
        }

        if (!shouldWatch) {
            compiler.close(() => { process.exit(); });
        } else {
            console.log(colors.cyan('--> Mode "watch" activé : en attente de modifications...\n'));
        }
    };

    if (shouldWatch) {
        compiler.watch({}, compilerCallback);
    } else {
        compiler.run(compilerCallback);
    }
};

export default executor;
