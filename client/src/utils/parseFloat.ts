/**
 * Permet de parser une valeur en nombre décimal basique (ex: 1.1, -12.3).
 *
 * @param value - La valeur à parser.
 *
 * @returns Le nombre décimal si valide, sinon `null`.
 */
const parseFloat = (value: unknown): number | null => {
    if (['', null, undefined].includes(value as any)) {
        return null;
    }

    const parsedValue = Number(value);
    return !Number.isNaN(parsedValue) && Number.isFinite(parsedValue)
        ? parsedValue
        : null;
};

export default parseFloat;
