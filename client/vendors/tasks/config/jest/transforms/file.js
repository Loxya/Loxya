import path from 'node:path';

export default {
    process(src, filename) {
        const assetFilename = JSON.stringify(path.basename(filename));
        return { code: `module.exports = ${assetFilename};` };
    },
};
