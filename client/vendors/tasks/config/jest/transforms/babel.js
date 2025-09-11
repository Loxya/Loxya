import babelJest from 'babel-jest';
import { fileURLToPath } from 'node:url';

const resolve = (packagePath) => fileURLToPath(
    import.meta.resolve(packagePath),
);

export default babelJest.createTransformer({
    presets: [resolve('@loxya/babel-config')],
    babelrc: false,
    configFile: false,
});
