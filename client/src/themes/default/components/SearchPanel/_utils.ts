import Day from '@/utils/day';
import Period from '@/utils/period';
import isEqualWith from 'lodash/isEqualWith';
import { TokenKind } from '@/themes/default/components/Search';

import type { Filters, FilterValue } from '.';
import type { Token, TokenDefinition } from '@/themes/default/components/Search';

const isComplexFilter = (value: unknown): value is Record<'operator' | 'value', unknown> => (
    value !== null &&
    typeof value === 'object' &&
    ('value' in value && 'operator' in value)
);

export const hasChangedFilters = (a: unknown, b: unknown): boolean => (
    !isEqualWith(a, b, (_a: unknown, _b: unknown) => {
        const aIsComplex = isComplexFilter(_a);
        const bIsComplex = isComplexFilter(_b);
        if (aIsComplex || bIsComplex) {
            if (aIsComplex && bIsComplex) {
                if (_a.operator !== _b.operator) {
                    return false;
                }
                return !hasChangedFilters(_a.value, _b.value);
            }
            return false;
        }

        // - Cas simples.
        if (_a instanceof Period && _b instanceof Period) {
            return _a.isSame(_b);
        }
        if (_a instanceof Day && _b instanceof Day) {
            return _a.isSame(_b);
        }
        return undefined;
    })
);

export const generateTokens = (definitions: TokenDefinition[]) => (
    (newValues: Filters, prevTokens: Token[] = []): Token[] => {
        const existingTokens: Token[] = [];

        // - Recherche textuelle.
        const newTerms = new Set(newValues.search);
        prevTokens.forEach((_token: Token, index: number) => {
            if (typeof _token !== 'string' || !newTerms.has(_token)) {
                return;
            }

            newTerms.delete(_token);
            existingTokens[index] = _token;
        });

        // - Custom tokens.
        const newTokens: Token[] = [];
        definitions.forEach((definition: TokenDefinition) => {
            if (definition.disabled) {
                return;
            }

            const newValue = newValues[definition.type] ?? null;
            const wasArray = Array.isArray(newValue);
            if (newValue !== null && (!wasArray || newValue.length > 0)) {
                let rawValues: FilterValue[] = !wasArray ? [newValue] : newValue;

                // - Si c'est une valeur d'un token de genre `list`, qu'il contenait
                //   un tableau de valeur et que le token en question était en mode
                //   "non multiple mais multiples valeurs" (= Multiples valeurs pour
                //   un seul opérateur). Alors on garde la logique plutôt que de
                //   splitter en de multiples tokens.
                //   (e.g. `['a', 'b']` => `{ type: 'foo', value: ['a', 'b'] }`) plutôt
                //    que `[{ type: 'foo', value 'a' }, { type: 'foo', value 'b' }]`)
                const isList = (
                    definition.kind === undefined ||
                    definition.kind === TokenKind.LIST
                );
                if (wasArray && isList && definition.multiSelect && (definition.unique ?? true)) {
                    const hasValidMultiSelectValues = rawValues.every((value: unknown) => (
                        ['number', 'string'].includes(typeof value)
                    ));
                    rawValues = hasValidMultiSelectValues
                        ? [rawValues as Array<string | number>]
                        : rawValues;
                }

                rawValues.forEach((value: FilterValue) => {
                    const isComplex = isComplexFilter(value);

                    const token: Token = (
                        !isComplex
                            ? { type: definition.type, value }
                            : {
                                type: definition.type,
                                operator: value.operator,
                                value: value.value,
                            }
                    );

                    const index = prevTokens.findIndex(
                        (_token: Token, _index: number) => (
                            !(_index in existingTokens) &&
                            typeof _token !== 'string' &&
                            _token.type === definition.type
                        ),
                    );
                    if (index !== -1) {
                        existingTokens[index] = token;
                    } else {
                        newTokens.push(token);
                    }
                });
            }
        });

        return existingTokens.concat(...newTerms, ...newTokens)
            .filter((token: Token | undefined) => token !== undefined);
    }
);
