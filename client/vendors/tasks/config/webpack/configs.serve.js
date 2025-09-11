import buildConfig from './config.js';

export default function serveConfig(devServerUrl) {
    const config = buildConfig('development', { hmr: true });

    const _patchConfigForServe = (singleConfig) => {
        singleConfig.output.publicPath = (
            `${devServerUrl.href}${singleConfig.output.publicPath.replace(/^\//, '')}`
        );
        return singleConfig;
    };

    return Array.isArray(config)
        ? config.map(_patchConfigForServe)
        : _patchConfigForServe(config);
}
