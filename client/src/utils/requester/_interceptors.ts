import axios from 'axios';
import deepObjectSet from 'lodash/set';
import { RequestError } from './_helpers';
import isPlainObject from 'lodash/isPlainObject';
import flattenObject from '@/utils/flattenObject';
import globalConfig from '@/globals/config';
import cookies from '@/utils/cookies';
import DateTime from '@/utils/datetime';
import Day from '@/utils/day';

import type { RequestConfig } from './_types';
import type {
    AxiosInterceptorManager,
    AxiosProgressEvent,
    AxiosResponse,
} from 'axios';

type Interceptor<T> = (
    | Parameters<AxiosInterceptorManager<T>['use']>
    | Parameters<AxiosInterceptorManager<T>['use']>[0]
);

type Interceptors = {
    request?: Interceptor<RequestConfig>,
    response?: Interceptor<AxiosResponse>,
};

const requestInterceptor: Interceptor<RequestConfig> = (rawConfig: RequestConfig): RequestConfig => {
    const { params, onProgress, ...others } = rawConfig;
    const config: RequestConfig = { ...others };

    // - Ajoute une méthode haut-niveau permettant de récupérer l'avancement sous forme numérique.
    //   - Si la méthode de la requête est POST, PUT ou PATCH, c'est l'événement `onUploadProgress` qui sera écouté.
    //   - Sinon ce sera `onDownloadProgress`
    if (onProgress) {
        const progressCallback = (event: AxiosProgressEvent): void => {
            if (!event.lengthComputable) {
                return;
            }

            const { loaded, total } = event;
            if (total === undefined) {
                return;
            }

            const percent = (loaded / total) * 100;
            onProgress(percent);
        };

        if (config.method && ['POST', 'PUT', 'PATCH'].includes(config.method.toUpperCase())) {
            config.onUploadProgress = progressCallback;
        } else {
            config.onDownloadProgress = progressCallback;
        }
    }

    // - Traitement spécial des objets littéraux contenant des fichiers.
    //   => On utilise un envoi via `multipart/form-data` et on met les données
    //      supplémentaires éventuelles dans une clé spéciale `@data`)
    const hasFiles = (
        isPlainObject(config.data) &&
        Object.values(config.data).some((value: unknown) => (
            value instanceof File
        ))
    );
    if (hasFiles) {
        const formData = new FormData();
        const data = Object.entries(flattenObject(config.data)).reduce(
            (_data: Record<string, unknown>, [key, value]: [string, unknown]) => {
                if (value instanceof File) {
                    formData.append(btoa(key), value);
                    return _data;
                }
                return deepObjectSet(_data, key, value);
            },
            {},
        );

        formData.append('@data', JSON.stringify(data));
        config.data = formData;
    }

    if (params) {
        Object.keys(params).forEach((name: keyof typeof params) => {
            if (params[name] === true) {
                params[name] = '1';
            }
            if (params[name] === false) {
                params[name] = '0';
            }
            if (params[name] instanceof DateTime || params[name] instanceof Day) {
                params[name] = params[name].toString();
            }
        });
        config.params = params;
    }

    const authToken = cookies.get(globalConfig.auth.cookie);
    if (authToken) {
        config.headers ??= {};
        config.headers.Authorization = `Bearer ${authToken}`;
    }

    return config;
};

const responseInterceptor: Interceptor<AxiosResponse> = [
    (response: AxiosResponse): any => response,
    (error: unknown): Promise<any> => {
        if (axios.isCancel(error)) {
            throw error;
        }
        return Promise.reject(RequestError.fromError(error));
    },
];

const interceptors: Interceptors = {
    request: requestInterceptor,
    response: responseInterceptor,
};

export default interceptors;
