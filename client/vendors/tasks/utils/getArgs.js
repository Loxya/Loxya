import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const getArgs = (asRaw = false) => {
    const rawArgs = hideBin(process.argv);
    return asRaw ? rawArgs : yargs(rawArgs).argv;
};

export default getArgs;
