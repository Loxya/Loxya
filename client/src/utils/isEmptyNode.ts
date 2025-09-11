/**
 * Détermine si un nœud JSX est considéré comme "vide".
 *
 * @param node - Le nœud à évaluer.
 *
 * @returns `true` si le nœud est vide, sinon `false`.
 */
const isEmptyNode = (node: JSX.Node): boolean => {
    if (node === undefined || node === null || typeof node === 'boolean') {
        return true;
    }

    if (Array.isArray(node)) {
        return node.every(isEmptyNode);
    }

    if (typeof node === 'string') {
        return node === '';
    }

    return false;
};

export default isEmptyNode;
