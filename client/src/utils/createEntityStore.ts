import formatOptions from '@/utils/formatOptions';

import type { DataShape, Options } from '@/utils/formatOptions';
import type { Module, GetterTree, ActionContext } from 'vuex';

export type EntityState<T> = { list: T[], isFetched: boolean };
export type EntityFetcher<T> = (
    | (() => Promise<T[]>)
    | (() => T[])
);

const createEntityStore = <T extends DataShape, R = any>(
    fetcher: EntityFetcher<T>,
    additionalGetters: Partial<GetterTree<EntityState<T>, R>> = {},
): Module<EntityState<T>, R> => {
    let ongoingFetch: Promise<T[]> | null = null;

    // - State initial.
    const initialState: EntityState<T> = {
        list: [],
        isFetched: false,
    };

    const store: Module<EntityState<T>, R> = {
        namespaced: true,
        state: initialState,
        getters: {
            options: (state: EntityState<T>): Options<T> => (
                formatOptions(state.list)
            ),
            ...additionalGetters,
        },
        mutations: {
            init(state: EntityState<T>, data: T[]) {
                state.list = data;
                state.isFetched = true;
            },
        },
        actions: {
            async fetch(
                { state, dispatch }: ActionContext<EntityState<T>, R>,
                shouldThrow: boolean = false,
            ): Promise<T[]> {
                if (state.isFetched) {
                    return state.list;
                }

                const hadOngoingFetch = ongoingFetch !== null;
                if (!hadOngoingFetch) {
                    ongoingFetch = dispatch('internalFetch', true) as Promise<T[]>;
                }

                let data: T[];
                try {
                    data = await ongoingFetch!;
                } catch (error) {
                    if (shouldThrow) {
                        throw error;
                    }
                    data = [];
                } finally {
                    if (!hadOngoingFetch) {
                        ongoingFetch = null;
                    }
                }

                return data;
            },

            async internalFetch(
                { commit }: ActionContext<EntityState<T>, R>,
                shouldThrow: boolean = false,
            ): Promise<T[]> {
                let data: T[];
                try {
                    data = await fetcher();
                    commit('init', data);
                } catch (error) {
                    // eslint-disable-next-line no-console
                    console.warn('Error while retrieving entity data', error);

                    if (shouldThrow) {
                        throw error;
                    }

                    data = [];
                }

                return data;
            },

            refresh(
                { state, dispatch }: ActionContext<EntityState<T>, R>,
                shouldThrow: boolean = false,
            ): Promise<T[]> {
                state.isFetched = false;
                return dispatch('internalFetch', shouldThrow);
            },
        },
    };

    return store;
};

export default createEntityStore;
