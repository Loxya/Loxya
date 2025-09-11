import * as jest from 'jest';
import getArgs from '../utils/getArgs.js';
import configsBuilder from '../config/jest/index.js';

const executor = (options) => {
    process.env.BABEL_ENV = 'test';
    process.env.NODE_ENV = 'test';

    // node loxya-tasks test (...)
    const argv = getArgs(true).slice(1);

    // - Définit l'option CI à `true` si la variable d'environnement `CI` est définie.
    if (process.env.CI && options.ci !== false) {
        options.ci = true;
        argv.push('--ci');
    }

    // - Si le mode watch est activé et que l'option `all` est explicitement passée => `watchAll: true`.
    if (options.watch && options.all) {
        options.watchAll = true;
        argv.push('--watchAll');
    }

    argv.push('--config', JSON.stringify(configsBuilder()));

    jest.run(argv);
};

export default executor;
