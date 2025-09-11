import buildConfig from './config.js';

/*
 * Ce fichier est présent afin de permettre d'importer facilement
 * la configuration Webpack dans la configuration ESLint du projet.
 *
 * Dans votre `eslint.config.mjs`, insérez :
 *
 * export default defineConfig({
 *     settings: {
 *         'import/resolver': {
 *             webpack: {
 *                 config: fileURLToPath(import.meta.resolve(
 *                     '@loxya/tasks/config/webpack',
 *                 )),
 *             },
 *         },
 *     },
 * });
 */

export default buildConfig('development');
