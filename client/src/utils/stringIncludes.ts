import stringCompare from '@/utils/stringCompare';

/**
 * Compare deux chaînes et retourne `true` si la chaîne passée en premier
 * paramètre contient celle qui est passée en deuxième.
 *
 * La comparaison utilisent les règles de la locale courante, en ignorant la
 * ponctuation et la casse.
 *
 * @see {@link stringCompare} - Pour en savoir plus sur l'algorithme de comparaison.
 *
 * @param haystack - La chaîne dans laquelle on souhaite chercher.
 * @param needle - La chaîne que l'on recherche.
 *
 * @returns `true` si la chaîne recherchée est présente dans la chaîne
 *          dans laquelle on cherche, `false` sinon.
 */
const stringIncludes = (haystack: string, needle: string): boolean => {
    const haystackLength = haystack.length;
    const needleLength = needle.length;

    if (haystackLength < needleLength) {
        return false;
    }

    if (haystackLength === needleLength) {
        return stringCompare(haystack, needle) === 0;
    }

    const lengthDiff = haystackLength - needleLength;
    for (let startChar = 0; startChar <= lengthDiff; startChar++) {
        const subString = haystack.substring(startChar, startChar + needleLength);
        if (stringCompare(subString, needle) === 0) {
            return true;
        }
    }

    return false;
};

export default stringIncludes;
