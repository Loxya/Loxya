export default (devServerUrl) => ({
    host: devServerUrl.hostname,
    port: +devServerUrl.port,

    headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': '*',
        'Access-Control-Allow-Headers': '*',
    },

    server: devServerUrl.protocol.replace(/:$/, ''),
    compress: true,
    allowedHosts: 'all',
    setupExitSignals: true,
    historyApiFallback: {
        // @see https://github.com/facebook/create-react-app/issues/387.
        disableDotRule: true,
    },

    // - Static dirs
    static: false,
});
