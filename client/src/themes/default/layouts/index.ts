import BlankLayout from './Blank';
import DefaultLayout from './Default';
import MinimalistLayout from './Minimalist';

export enum Layout {
    /** Layout par défaut. */
    DEFAULT = 'default',

    /** Layout vide. */
    BLANK = 'blank',

    /** Layout minimaliste. */
    MINIMALIST = 'minimalist',
}

export default {
    [Layout.BLANK]: BlankLayout,
    [Layout.DEFAULT]: DefaultLayout,
    [Layout.MINIMALIST]: MinimalistLayout,
};
