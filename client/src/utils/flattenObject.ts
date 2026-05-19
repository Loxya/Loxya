import isPlainObject from 'lodash/isPlainObject';

type PathSegment = number | string;

const stringifyPathSegments = (pathSegments: PathSegment[]): string => (
    pathSegments.reduce(
        (result: string, segment: PathSegment, index: number) => {
            if (typeof segment === 'number') {
                return `${result}[${segment}]`;
            }

            segment = segment.replaceAll(/[\\.[]/g, '\\$&');
            return result + (index === 0 ? segment : `.${segment}`);
        },
        '',
    )
);

/**
 * Permet de mettre à plat un object en conservant la notion de profondeur dans les clés
 * via une notation sous forme de point / crochets (pour les tableaux).
 *
 * L'objet pourra ensuite être reconstitué en utilisant un outil comme `lodash#set()`.
 *
 * @example
 * Pour un object: `{ foo: 'bar' }` donnera `{ foo: 'bar' }`.
 * Pour un object: `{ foo: { bar: 'buz' } }` donnera `{ 'foo.bar': 'buz' }`.
 * Pour un object: `{ foo: { bar: ['buz', 'biz'] } }` donnera `{ 'foo.bar[0]': 'buz', 'foo.bar[1]': 'biz' }`.
 *
 * @param object - L'object à mettre à plat.
 *
 * @returns Un objet d'un seul niveau, avec les clés contenant les informations de profondeur.
 */
const flattenObject = (object: Record<string, unknown>): AnyLiteralObject => {
    const deepKeysIterator = function* (
        currentValue: unknown,
        currentPath: PathSegment[] = [],
    ): IterableIterator<[string, unknown]> {
        if (!isPlainObject(currentValue) && !Array.isArray(currentValue)) {
            if (currentPath.length > 0) {
                yield [stringifyPathSegments(currentPath), currentValue];
            }
            return;
        }

        const entries: Array<[string | number, unknown]> = Array.isArray(currentValue)
            ? currentValue.map((_value: unknown, index: number) => [index, _value])
            : Object.entries(currentValue as Record<string, unknown>);

        // eslint-disable-next-line no-restricted-syntax
        for (const [key, value] of entries) {
            yield* deepKeysIterator(value, [...currentPath, key]);
        }
    };
    return Object.fromEntries(deepKeysIterator(object));
};

export default flattenObject;
