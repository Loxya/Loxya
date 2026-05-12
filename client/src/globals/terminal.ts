/* eslint-disable import/prefer-default-export */

import parseInteger from '@/utils/parseInteger';
import getMaxCanvasPixelsCore from '@/utils/getMaxCanvasPixels';

/**
 * Retourne le nombre maximal de pixels qu'un élément `<canvas>` peut
 * contenir sur ce terminal.
 *
 * Cette fonction met le résultat en cache dans le stockage de session lors du
 * premier appel et renvoie la valeur mise en cache les fois suivantes (jusqu'au
 * redémarrage du navigateur).
 *
 * Pour un résultat fraîchement calculé, utilisez plutôt `@/utils/getMaxCanvasPixels`.
 *
 * @returns Un nombre qui représente le nombre maximal de pixels.
 *          (y compris `0` qui signifie que l'élément `<canvas>` n'est pas
 *          pris en charge)
 */
export const getMaxCanvasPixels = (): number => {
    const cachedMaxCanvasPixels: number | null = (() => {
        const rawValue = sessionStorage.getItem('maxCanvasPixels');
        return rawValue !== null ? parseInteger(rawValue) : null;
    })();
    if (cachedMaxCanvasPixels !== null) {
        return cachedMaxCanvasPixels;
    }

    const maxCanvasPixels = getMaxCanvasPixelsCore();
    sessionStorage.setItem('maxCanvasPixels', maxCanvasPixels.toString());

    return maxCanvasPixels;
};
