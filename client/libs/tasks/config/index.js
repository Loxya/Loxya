import fs from 'node:fs';
import path from 'node:path';

const appDirectory = fs.realpathSync(process.cwd());
const resolveApp = (relativePath) => path.resolve(appDirectory, relativePath);

const config = {
    rootPath: resolveApp('.'),
    sourcePath: resolveApp('./src'),
    destinationPath: resolveApp('./dist'),
    nodeModulesPath: resolveApp('./node_modules'),
    cachePath: resolveApp('./node_modules/.cache'),
    publicPath: '/webclient/',
};

export default config;
