import 'v-tooltip';

declare module 'v-tooltip' {
    export type TooltipPlacement = (
        | 'top'
        | 'top-start'
        | 'top-end'
        | 'right'
        | 'right-start'
        | 'right-end'
        | 'bottom'
        | 'bottom-start'
        | 'bottom-end'
        | 'left'
        | 'left-start'
        | 'left-end'
    );

    export type TooltipOptions = {
        content: string,
        placement?: TooltipPlacement,
    };
}
