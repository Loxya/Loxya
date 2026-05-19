import webpack from 'webpack';
import getPort from 'get-port';
import colors from 'picocolors';
import WebpackDevServer from 'webpack-dev-server';
import clearConsole from '../utils/clearConsole.js';
import configsBuilder from '../config/webpack/configs.serve.js';
import createDevServerConfig from '../config/webpack/dev-server.js';
import wrapServeCompiler from '../utils/wrapWebpackServeCompiler.js';

const DEV_CLIENT_URL = new URL('http://0.0.0.0:3000');

const isInteractive = process.stdout.isTTY;

const executor = async () => {
    process.env.BABEL_ENV = 'development';
    process.env.NODE_ENV = 'development';

    try {
        const port = await getPort({ host: DEV_CLIENT_URL.hostname, port: +DEV_CLIENT_URL.port });
        if (+DEV_CLIENT_URL.port !== port) {
            let message = `Un autre service est déjà en cours d'exécution sur le port ${DEV_CLIENT_URL.port}.`;
            if (process.platform !== 'win32' && DEV_CLIENT_URL.port < 1024 && process.getuid?.() !== 0) {
                message = 'Les droits administrateur sont requis pour exécuter un serveur sur un port inférieur à 1024.';
            }
            console.error(`${colors.red(message)}\n`);
            process.exit(1);
        }

        const config = configsBuilder(DEV_CLIENT_URL);

        let compiler;
        try {
            compiler = wrapServeCompiler(webpack(config));
        } catch (err) {
            console.log(colors.red('Erreur lors de la compilation.\n'));
            console.log(err.message || err);
            console.log();
            process.exit(1);
        }

        const serverConfig = createDevServerConfig(DEV_CLIENT_URL);
        const devServer = new WebpackDevServer(serverConfig, compiler);
        await devServer.start();

        if (isInteractive) {
            clearConsole();
        }
        console.log(colors.cyan('Lancement du serveur de développement...\n'));

        process.stdin.on('end', async () => {
            await devServer.stop();
            process.exit();
        });
    } catch (err) {
        if (err && err.message) {
            console.log(err.message);
        }
        process.exit(1);
    }
};

export default executor;
