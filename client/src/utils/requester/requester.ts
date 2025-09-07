import axios from 'axios';
import invariant from 'invariant';
import globalConfig from '@/globals/config';
import interceptors from './_interceptors';

import type { AxiosInstance, AxiosResponse } from 'axios';
import type { RequestConfig, RequestXhrPromise, ResponseHeaders } from './_types';

class Requester {
    /** Instance d'Axios. */
    private _instance: AxiosInstance | undefined;

    /** L'initialisation a-t-elle déjà été faite ? */
    private _isInitialized: boolean;

    /**
     * Retourne l'état d'initialisation de `Requester`.
     *
     * @returns L'état d'initialisation de `Requester`.
     */
    public get isInitialized(): boolean {
        return this._isInitialized;
    }

    /**
     * Point d'entrée vers la propriété `interceptors` d'Axios.
     *
     * @returns L'objet contenant les intercepteurs de requête/réponse d'Axios.
     */
    public get interceptors(): AxiosInstance['interceptors'] {
        invariant(
            (this._isInitialized && this._instance),
            '[Requester] Initialization (`Requester.init({ ... })`) must be ' +
            'done prior to any modifications to the interceptors.',
        );
        return this._instance.interceptors;
    }

    /**
     * Constructeur.
     *
     * @param config - Si défini, déclenche l'initialisation immédiate (`Requester.init()`)
     *                 avec la configuration passée.
     */
    constructor(config?: RequestConfig) {
        this._isInitialized = false;

        if (config) {
            this.init(config);
        }
    }

    /**
     * Initialisation.
     *
     * @param config - L'objet littéral contenant la configuration de base
     *                 utilisée pour toutes les requêtes.
     *                 correspond à la configuration supportée par Axios.
     */
    public init(config: RequestConfig = {}): void {
        invariant(!this._isInitialized, '[Requester] Unexpected duplicate initialization.');
        this._isInitialized = true;

        // - Création de l'instance.
        const defaultConfig: RequestConfig = {
            baseURL: globalConfig.api.url,
            headers: globalConfig.api.headers,
        };
        this._instance = axios.create({ ...defaultConfig, ...config });

        // - Intercepteurs
        (['request', 'response'] as const).forEach((type) => {
            if (!(type in interceptors)) {
                return;
            }

            const interceptor = !Array.isArray(interceptors[type])
                ? [interceptors[type], (err: unknown) => Promise.reject(err)]
                : interceptors[type];

            this.interceptors[type].use(...interceptor as any[]);
        });
    }

    /**
     * Exécute une requête HTTP.
     *
     * @param config - La configuration de la requête contenant l'URL, la méthode à utiliser, les données éventuelles, etc.
     *                 Les valeurs par défaut sont celles passées lors de l'initialisation.
     *
     * @returns Une promesse résolue avec un objet contenant les informations de réponse
     *          sous la forme : `{ headers: {...}, data: {...}, ... }`.
     */
    public exec<T = never>(config: RequestConfig): RequestXhrPromise<T> {
        invariant(
            this._isInitialized,
            '[Requester] The initialization (`Request.init({ ... })`) must be ' +
            'done before calling the query methods.',
        );
        return this._instance!.request<T>(config);
    }
}

//
// - Méthodes HTTP utilitaires
//

interface Requester {
    head(url: string, config?: RequestConfig): Promise<ResponseHeaders>;
    options(url: string, config?: RequestConfig): Promise<ResponseHeaders>;

    get<Data = unknown>(url: string, config?: RequestConfig): Promise<Data>;
    delete<Data = unknown>(url: string, config?: RequestConfig): Promise<Data>;

    post<Data = unknown>(url: string, data?: unknown, config?: RequestConfig): Promise<Data>;
    put<Data = unknown>(url: string, data?: unknown, config?: RequestConfig): Promise<Data>;
    patch<Data = unknown>(url: string, data?: unknown, config?: RequestConfig): Promise<Data>;

    postForm<Data = unknown>(url: string, data?: unknown, config?: RequestConfig): Promise<Data>;
    putForm<Data = unknown>(url: string, data?: unknown, config?: RequestConfig): Promise<Data>;
    patchForm<Data = unknown>(url: string, data?: unknown, config?: RequestConfig): Promise<Data>;
}

(['head', 'options'] as const).forEach((method) => {
    // eslint-disable-next-line func-names
    Requester.prototype[method] = function(
        url: string,
        config: RequestConfig = {},
    ): Promise<ResponseHeaders> {
        const xhrPromise = this.exec({ ...config, method, url });
        return xhrPromise.then(({ headers }: AxiosResponse): ResponseHeaders => headers);
    };
});

(['delete', 'get'] as const).forEach((method) => {
    // eslint-disable-next-line func-names
    Requester.prototype[method] = function<T = never>(
        url: string,
        config: RequestConfig = {},
    ): Promise<T> {
        const xhrPromise = this.exec<T>({ ...config, method, url });
        return xhrPromise.then(({ data }: AxiosResponse<T>): T => data);
    };
});

(['post', 'put', 'patch'] as const).forEach((baseMethod) => {
    ([baseMethod, `${baseMethod}Form`] as const).forEach((method) => {
        // eslint-disable-next-line func-names
        Requester.prototype[method] = function<T = never>(
            url: string,
            data: unknown = {},
            config: RequestConfig<T> = {},
        ): Promise<T> {
            const xhrPromise = this.exec<T>({ ...config, method, data, url });
            return xhrPromise.then(({ data: _data }: AxiosResponse<T>): T => _data);
        };
    });
});

export default Requester;
