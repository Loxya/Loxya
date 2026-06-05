export type ScreenSizeHandler = (size: ScreenSize) => void;

export type Canceller = () => void;

/** Taille de l'écran, normalisée. */
export enum ScreenSize {
    /** Mobile */
    MOBILE = 'mobile',

    /** Tablette */
    TABLET = 'tablet',

    /** Écran normal */
    DESKTOP = 'desktop',

    /** Grand écran */
    BIG_DESKTOP = 'big-desktop',
}

// - Doit rester synchronisé avec les variables de
//   `style/globals/variables/_dimensions.scss`.
const BREAKPOINTS = Object.freeze({
    [ScreenSize.MOBILE]: 580,
    [ScreenSize.TABLET]: 768,
    [ScreenSize.DESKTOP]: 1024,
    [ScreenSize.BIG_DESKTOP]: 1400,
});

/**
 * Renvoie la classe de taille de l'écran, normalisée.
 *
 * @returns La taille courante de l'écran, normalisée.
 */
export const getScreenSize = (): ScreenSize => {
    const matches = (size: ScreenSize): boolean => (
        window.matchMedia(`(min-width: ${BREAKPOINTS[size]}px)`).matches
    );

    switch (true) {
        case matches(ScreenSize.BIG_DESKTOP): {
            return ScreenSize.BIG_DESKTOP;
        }
        case matches(ScreenSize.DESKTOP): {
            return ScreenSize.DESKTOP;
        }
        case matches(ScreenSize.TABLET): {
            return ScreenSize.TABLET;
        }
        default: {
            return ScreenSize.MOBILE;
        }
    }
};

const observeAndProcess = (handler: ScreenSizeHandler): Canceller => {
    const queries = Object.values(BREAKPOINTS).map(
        (breakpoint) => window.matchMedia(`(min-width: ${breakpoint}px)`),
    );

    let current = getScreenSize();
    const processor = (): void => {
        const next = getScreenSize();
        if (next !== current) {
            current = next;
            handler(next);
        }
    };

    queries.forEach((query) => {
        query.addEventListener('change', processor);
    });

    return () => {
        queries.forEach((query) => {
            query.removeEventListener('change', processor);
        });
    };
};

let cancelProcessing: Canceller | null = null;
const observers: Set<ScreenSizeHandler> = new Set();

/**
 * Observe les changements de taille d'écran.
 *
 * @param handler - Le gestionnaire appelé à chaque changement de palier.
 *
 * @returns Une fonction permettant d'arrêter l'observation.
 */
export const observeScreenSize = (handler: ScreenSizeHandler): Canceller => {
    if (observers.size === 0 || cancelProcessing === null) {
        cancelProcessing = observeAndProcess((size) => {
            observers.forEach((_handler) => {
                _handler(size);
            });
        });
    }

    observers.add(handler);

    return () => {
        observers.delete(handler);

        if (observers.size === 0 && cancelProcessing !== null) {
            cancelProcessing();
            cancelProcessing = null;
        }
    };
};
