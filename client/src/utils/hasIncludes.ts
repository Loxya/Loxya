/**
 * Vérifie si une chaîne donnée contient au moins une des sous-chaînes fournies.
 *
 * @param needle - La chaîne dans laquelle effectuer la recherche.
 * @param searches - La liste des sous-chaînes à rechercher.
 *
 * @returns `true` si au moins une des sous-chaînes est présente, sinon `false`.
 */
const hasIncludes = (needle: string, searches: string[]): boolean => (
    searches.some((search: string) => needle.includes(search))
);

export default hasIncludes;
