/**
 * Permet de parser une valeur en nombre entier.
 *
 * @param value - La valeur à parser.
 *
 * @returns Le nombre entier si valide, sinon `null`.
 */
const parseInteger = (value: unknown): number | null => {
    if (['', null, undefined].includes(value as any)) {
        return null;
    }

    const parsedValue = Number(value);
    return !Number.isNaN(parsedValue) && Number.isInteger(parsedValue)
        ? parsedValue
        : null;
};

export default parseInteger;
