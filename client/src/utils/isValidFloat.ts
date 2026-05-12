/**
 * Permet de vérifier qu'une valeur contient bien un nombre flottant.
 *
 * @param value - La valeur à vérifier.
 *
 * @returns `true` si la valeur contient un nombre flottant, `false` sinon.
 */
const isValidFloat = (value: unknown): value is number | `${number}` => {
    if (typeof value === 'number') {
        return !Number.isNaN(value) && Number.isFinite(value);
    }
    return typeof value === 'string' ? /^-?\d+(?:\.\d*)?$/.test(value) : false;
};

export default isValidFloat;
