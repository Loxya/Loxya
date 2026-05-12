import { z } from '@/utils/validation';

import type { SchemaInfer } from '@/utils/validation';

const schema = z
    .object({
        columns: z.record(z.string(), z.boolean()).optional(),
        orderBy: z
            .object({
                column: z.union([z.string(), z.literal(false), z.undefined()]).transform(
                    (value: string | false | undefined): string | undefined => (
                        typeof value === 'string' ? value : undefined
                    ),
                ),
                ascending: z.union([z.boolean(), z.undefined()]),
            })
            .nullish()
            .transform((rawOrderBy) => (
                rawOrderBy !== undefined && rawOrderBy !== null && rawOrderBy.column !== undefined
                    ? { column: rawOrderBy.column, ascending: rawOrderBy.ascending ?? true }
                    : undefined
            )),

        // - Legacy.
        userControlsColumns: z.boolean().optional(),
        userColumnsDisplay: z.string().array().optional(),
    })
    .transform((rawState) => ({
        orderBy: rawState.orderBy ?? null,
        columns: rawState.columns === undefined && rawState.userControlsColumns
            ? Object.fromEntries((rawState.userColumnsDisplay ?? [])
                .map((column: string) => [column, true]))
            : (rawState.columns ?? {}),
    }));

type State = SchemaInfer<typeof schema>;

const getStateKey = (tableName: string, legacy: boolean = false): string => (
    legacy ? `vuetables_${tableName}` : `Table--${tableName}`
);

export const getStoredState = (tableName: string): State | null => {
    const storedTableState = (
        localStorage.getItem(getStateKey(tableName))
            ?? localStorage.getItem(getStateKey(tableName, true))
    );
    if (!storedTableState) {
        return null;
    }

    let storedState;
    try {
        storedState = schema.parse(JSON.parse(storedTableState));
    } catch {
        localStorage.removeItem(getStateKey(tableName));
        localStorage.removeItem(getStateKey(tableName, true));
        return null;
    }

    return storedState ?? null;
};

export const storeState = (tableName: string, state: State): void => {
    localStorage.setItem(getStateKey(tableName), JSON.stringify(state));
};
