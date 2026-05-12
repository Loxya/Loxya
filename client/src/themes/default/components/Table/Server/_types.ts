import type { Merge } from 'type-fest';
import type { Datum, Column as CoreColumn } from '../@types';
import type {
    PaginatedData,
    SortableParams,
    PaginationParams,
} from '@/stores/api/@types';

export type RequestFunction<
    D extends Datum<K> = any,
    K extends string = 'id',
> = (
    (pagination: PaginationParams & SortableParams) => (
        Promise<PaginatedData<D[]> | undefined>
    )
);

export type Column<
    D extends Datum<K> = any,
    K extends string = 'id',
> = Merge<CoreColumn<D, K>, {
    /** Le tri doit-il être activé sur cette colonne ? */
    sortable?: boolean,
}>;

export type Columns<
    D extends Datum<K> = any,
    K extends string = 'id',
> = Array<Column<D, K>>;
