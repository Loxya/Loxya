export { HttpStatusCode as HttpCode } from 'axios';

//
// - Built-in error codes
//

export enum ClientErrorCode {
    NETWORK_ERROR = 'CLIENT_NETWORK_ERROR',
    TIMEOUT_ERROR = 'CLIENT_TIMEOUT_ERROR',
}
