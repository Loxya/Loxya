export default {
    process() {
        return { code: 'module.exports = {};' };
    },
    getCacheKey() {
        // - La sortie est toujours la même.
        return 'cssTransform';
    },
};
