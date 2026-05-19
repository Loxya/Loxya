/**
 * Limite arbitraire au-delà de laquelle on arrête de tester la compatibilité.
 * (Ce nombre représente un des côtés du carré max testé)
 */
const MAX_TESTED_SIZE = 20_480;

/**
 * Renvoie le nombre maximal de pixels qu'un élément `<canvas>` peut contenir.
 *
 * @returns Un nombre qui représente le nombre maximal de pixels.
 *          (incluant `0` ce qui signifie que l'élément `<canvas>` n'est pas supporté)
 */
const getMaxCanvasPixels = (): number => {
    const hasCanvasSupport = window && 'HTMLCanvasElement' in window;
    if (!hasCanvasSupport) {
        return 0;
    }

    const sizes: number[] = [];
    while (!sizes.length || sizes[0] < MAX_TESTED_SIZE) {
        sizes.unshift((sizes[0] ?? 0) + 1024);
    }

    const controlCanvas = document.createElement('canvas');
    controlCanvas.width = 1;
    controlCanvas.height = 1;

    const controlCanvasCtx = controlCanvas.getContext('2d', { willReadFrequently: true });
    if (!controlCanvasCtx) {
        return 0;
    }

    const maxSize = sizes.find((size: number) => {
        const testCanvas = document.createElement('canvas');
        testCanvas.width = size;
        testCanvas.height = size;

        const testCanvasCtx = testCanvas.getContext('2d');
        if (!testCanvasCtx) {
            return false;
        }

        // - Dessiner un pixel de test dans le coin inférieur droit d'un canvas de la taille testée.
        testCanvasCtx.fillRect(size - 1, size - 1, 1, 1);

        // - Puis, tenter de redessiner ce pixel dans notre canvas de contrôle.
        controlCanvasCtx.drawImage(testCanvas, size - 1, size - 1, 1, 1, 0, 0, 1, 1);

        // - Libérer le canvas de test de la mémoire.
        testCanvas.width = 1;
        testCanvas.height = 1;
        testCanvasCtx.clearRect(0, 0, 1, 1);

        // - Enfin, on regarde le canal alpha du pixel censé avoir été dessiné,
        //   s'il est différent de 0, cela signifie que le terminal a pu
        //   supporter la taille du canvas de test.
        return controlCanvasCtx.getImageData(0, 0, 1, 1).data[3] !== 0;
    });

    // - Libérer le canvas de contrôle de la mémoire.
    controlCanvasCtx.clearRect(0, 0, 1, 1);

    return maxSize ? maxSize ** 2 : 0;
};

export default getMaxCanvasPixels;
