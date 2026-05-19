import { globSync } from 'glob';

const glob = (pattern, options = {}) => {
    // - Remplace tous les séparateurs de chemin avec des anti-slashes
    //   (style Windows) par des slashes, sauf les doubles anti-slashes
    //   qui peuvent être utilisées pour l'échappement.
    const normalizePattern = pattern.replaceAll(
        /\\{2}|\\/g,
        (match) => (match.length === 2 ? '\\' : '/'),
    );
    return globSync(normalizePattern, options);
};

export default glob;
