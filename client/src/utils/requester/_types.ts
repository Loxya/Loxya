import type { ClientErrorCode } from './_constants';
import type { ApiErrorCode } from '@/stores/api/@codes';
import type {
    AxiosResponse,
    AxiosRequestConfig,
    AxiosResponseHeaders,
    RawAxiosResponseHeaders,
} from 'axios';

export type ResponseHeaders = RawAxiosResponseHeaders | AxiosResponseHeaders;

//
// - Request
//

export type ProgressCallback = (percent: number) => void;

export type RequestConfig<D = any> = (
    & AxiosRequestConfig<D>
    & { onProgress?: ProgressCallback }
);

export type RequestXhrPromise<Data = never> = Promise<AxiosResponse<Data>>;

//
// - Errors
//

export type ErrorCode = ClientErrorCode | ApiErrorCode;
