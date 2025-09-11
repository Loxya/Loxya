import fs from 'node:fs';
import path from 'node:path';
import glob from './glob.js';
import { fileURLToPath } from 'node:url';
import criticalInvariant from './criticalInvariant.js';

const resolve = (packagePath) => fileURLToPath(
    import.meta.resolve(packagePath),
);

const _getThemesPaths = (entriesPath) => {
    const themesDirPath = path.join(entriesPath, 'themes');
    criticalInvariant(
        fs.existsSync(themesDirPath),
        `Missing \`themes\` directory in ${entriesPath}.`,
    );

    const _getEntryGlobs = (entryPath) => [
        path.join(entryPath, '*.{js,ts,tsx}'),
        path.join(entryPath, '*/index.{js,ts,tsx}'),
    ];

    // - Themes
    const entries = _getEntryGlobs(themesDirPath);

    return entries.reduce(
        (acc, entryGlob) => acc.concat(
            glob(entryGlob, { absolute: true }),
        ),
        [],
    );
};

const _getEntries = (entriesPath) => {
    // - SPA entrypoint.
    const singleEntryPointGlob = path.join(entriesPath, 'index.{js,ts,tsx}');
    const singleEntryPointPath = glob(singleEntryPointGlob, { absolute: true }).shift();
    if (singleEntryPointPath) {
        return { index: [singleEntryPointPath] };
    }

    // - Themes entrypoints
    const paths = _getThemesPaths(entriesPath);
    return paths.reduce(
        (acc, absolutePath) => {
            const relativePath = path.relative(entriesPath, absolutePath);

            let entryPath = absolutePath;
            let name = path.basename(relativePath, path.extname(relativePath));
            if (name === 'index') {
                name = path.basename(path.dirname(relativePath));
                const specificEntryGlob = path.resolve(path.dirname(absolutePath), './entry.{js,ts,tsx}');
                const specificEntryPath = glob(specificEntryGlob).shift();
                entryPath = specificEntryPath || absolutePath;
            }

            acc[name] = [entryPath];
            return acc;
        },
        {},
    );
};

const getWebpackEntries = (entriesPath) => {
    const entries = _getEntries(entriesPath);

    Object.keys(entries).forEach((entry) => {
        entries[entry].unshift(resolve('@loxya/polyfill'));
    });

    return entries;
};

export default getWebpackEntries;
