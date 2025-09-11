/* eslint-disable import/prefer-default-export */

import invariant from 'invariant';
import isValidInteger from '@/utils/isValidInteger';
import parseInteger from '@/utils/parseInteger';
import axios, { AxiosError } from 'axios';
import isPlainObject from 'lodash/isPlainObject';
import { ApiErrorCode } from '@/stores/api/@codes';
import { ClientErrorCode } from './_constants';

import type { AxiosResponse } from 'axios';
import type { HttpCode } from './_constants';
import type { ErrorCode } from './_types';

type ErrorPayload = {
    code: ErrorCode,
    message: string | undefined,
    details: unknown | undefined,
};

const normalizeErrorPayload = (payload: unknown): ErrorPayload => {
    const normalizedErrorPayload = isPlainObject(payload) ? payload : {};
    const { code: rawCode, message: rawMessage, ...extraFields } = normalizedErrorPayload;

    const code: ApiErrorCode = (() => {
        if (isValidInteger(rawCode)) {
            const normalizedCode = parseInteger(rawCode)!;
            if (Object.values(ApiErrorCode).includes(normalizedCode as any)) {
                return parseInteger(rawCode)! as ApiErrorCode;
            }
        }

        // eslint-disable-next-line no-console
        console.warn(
            'A response with an unknown `ApiErrorCode` ' +
            `has been returned: ${String(rawCode)}.`,
        );

        return ApiErrorCode.UNKNOWN;
    })();

    const message = typeof rawMessage === 'string'
        ? rawMessage
        : undefined;

    const details = Object.keys(extraFields).length > 0
        ? ('details' in extraFields ? extraFields.details : extraFields)
        : undefined;

    return { code, message, details };
};

export class RequestError extends Error {
    public readonly code: ErrorCode;

    public readonly httpCode: HttpCode | undefined;

    public readonly details: any | undefined;

    constructor(
        code: ErrorCode,
        message?: string,
        cause?: ErrorOptions['cause'],
        details?: any,
        httpCode?: HttpCode,
    ) {
        message ??= httpCode ? `Request failed with status code ${httpCode}` : 'Request failed';
        super(message, { cause });

        this.name = 'RequestError';
        this.code = code;
        this.details = details;
        this.httpCode = httpCode;
    }

    //
    // - Factories.
    //

    public static fromAxiosResponse({ status, data: payload }: AxiosResponse, cause?: ErrorOptions['cause']): RequestError {
        invariant(
            status < 200 || status > 299,
            'Error: Trying to create a request error from a successful response.',
        );

        const { code, message, details } = normalizeErrorPayload(payload?.error ?? payload);
        return new RequestError(code, message, cause, details, status as HttpCode);
    }

    public static fromAxiosError(error: AxiosError): RequestError {
        if (error.response) {
            return RequestError.fromAxiosResponse(error.response, error);
        }

        let code: ErrorCode = ApiErrorCode.UNKNOWN;
        if (AxiosError.ERR_NETWORK === error.code) {
            code = ClientErrorCode.NETWORK_ERROR;
        }
        if ([AxiosError.ECONNABORTED, AxiosError.ETIMEDOUT].includes(error.code as any)) {
            code = ClientErrorCode.TIMEOUT_ERROR;
        }
        return new RequestError(code, undefined, error);
    }

    public static fromError(error: unknown): RequestError {
        if (axios.isAxiosError(error)) {
            return RequestError.fromAxiosError(error);
        }
        return new RequestError(ApiErrorCode.UNKNOWN, undefined, error);
    }
}
