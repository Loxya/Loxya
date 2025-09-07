import cssnano from 'cssnano';
import flexbugsFixes from 'postcss-flexbugs-fixes';
import postcssPresetEnv from 'postcss-preset-env';
import browserslistConfig from '@loxya/browserslist-config';
import cssnanoConfig from './cssnano.js';

export default (options = {}) => [
    flexbugsFixes(),
    postcssPresetEnv({
        stage: 2,
        browsers: browserslistConfig,
        autoprefixer: {
            overrideBrowserslist: browserslistConfig,
            remove: false,
        },
        features: {
            'all-property': false,
            'unset-value': false,
            'logical-properties-and-values': true,
            'light-dark-function': false,
        },
    }),
    (options.optimize ?? true) && cssnano(cssnanoConfig(!!options.compact)),
].filter(Boolean);
