export default (compact = false) => ({
    preset: ['default', {
        normalizeWhitespace: compact,

        // @see https://github.com/postcss/postcss-calc/issues/77
        calc: false,
    }],
});
