import 'axios';

declare module 'axios' {
    interface AxiosProgressEvent {
        loaded: number;
        total?: number;
        progress?: number;
        bytes: number;
        rate?: number;
        estimated?: number;
        upload?: boolean;
        download?: boolean;
        event?: BrowserProgressEvent;
        lengthComputable: boolean;
    }
}
