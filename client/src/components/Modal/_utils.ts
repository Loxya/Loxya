export const lockBodyScroll = (() => {
    /** Compteur actuel de locks. */
    let lockCount = 0;

    /** Valeur initiale du style `overflow` sur le body. */
    let previousOverflowValue: string | undefined;

    /**
     * Bloque le scroll du `<body>` tant que le verrou n'a pas été relâché.
     *
     * @returns Une fonction à appeler pour relâcher le verrou.
     */
    return (): (() => void) => {
        const $body = document.body;

        if (lockCount === 0 || $body.style.overflow !== 'hidden') {
            previousOverflowValue = $body.style.overflow;
            $body.style.overflow = 'hidden';
        }
        lockCount += 1;

        return (): void => {
            lockCount -= 1;

            if (lockCount === 0) {
                $body.style.overflow = previousOverflowValue ?? '';
                previousOverflowValue = undefined;
            }
        };
    };
})();

/**
 * Convertit une dimension brute en valeur CSS utilisable dans une `style` inline.
 * (les nombres deviennent des pixels, les chaînes restent telles
 * quelles pour permettre les pourcentages, `'auto'`, etc.).
 *
 * @param value - La dimension à convertir.
 *
 * @returns La valeur CSS correspondante.
 */
export const dimensionToCss = (value: number | string): string => (
    typeof value === 'number' ? `${value}px` : value
);
