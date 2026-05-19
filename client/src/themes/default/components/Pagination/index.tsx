import './index.scss';
import { defineComponent } from 'vue';
import config from '@/globals/config';
import formatNumber from '@/utils/formatNumber';

import type { PropType } from 'vue';

export type Props = {
    /** Le numéro de la page actuelle. */
    currentPage: number,

    /** Le nombre total d'éléments paginés. */
    totalItems: number,

    /**
     * Nombre de résultats par page paginée.
     *
     * @default {config.defaultPaginationLimit}
     */
    perPage?: number,

    /**
     * Fonction appelée lorsque l'utilisateur a demandé
     * l'affichage d'une nouvelle page.
     *
     * @param newPage - Le numéro de la nouvelle page à afficher.
     */
    onChange?(newPage: number): void,
};

/** Le nombre de pages dans "chunk" de pagination. */
const PAGINATION_CHUNK = 7;

type Data = {
    chunkFirstPage: number,
};

/** Une pagination. */
const Pagination = defineComponent({
    name: 'Pagination',
    props: {
        currentPage: {
            type: Number as PropType<Props['currentPage']>,
            required: true,
            validator: (value: number) => value > 0,
        },
        totalItems: {
            type: Number as PropType<Props['totalItems']>,
            required: true,
            validator: (value: number) => value >= 0,
        },
        perPage: {
            type: Number as PropType<Required<Props>['perPage']>,
            default: () => config.defaultPaginationLimit,
            validator: (value: number) => value > 0,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onChange: {
            type: Function as PropType<Props['onChange']>,
            default: undefined,
        },
    },
    emits: ['change'],
    data(): Data {
        const totalPages = this.totalItems > 0
            ? Math.ceil(this.totalItems / Math.max(this.perPage, 1))
            : 1;

        const maxFirstPage = Math.max(1, totalPages - PAGINATION_CHUNK + 1);
        const chunkFirstPage = Math.min(Math.max(1, this.currentPage), maxFirstPage);
        return { chunkFirstPage };
    },
    computed: {
        currentChunk(): number {
            return Math.ceil(this.currentPage / PAGINATION_CHUNK);
        },

        totalPages(): number {
            if (this.totalItems <= 0) {
                return 1;
            }
            return Math.ceil(this.totalItems / Math.max(this.perPage, 1));
        },

        pagesInCurrentChunk(): number {
            // - S'il nous reste assez de page pour un chunk complet,
            //   il y a le nombre max de pages dans un chunk.
            if ((this.chunkFirstPage + PAGINATION_CHUNK) <= this.totalPages) {
                return PAGINATION_CHUNK;
            }
            return (this.totalPages - this.chunkFirstPage) + 1;
        },

        currentChunkPages(): number[] {
            if (this.totalItems <= 0) {
                return [];
            }

            return Array.from(
                { length: this.pagesInCurrentChunk },
                (_, index) => this.chunkFirstPage + index,
            );
        },

        hasItems(): boolean {
            return this.totalItems > 0;
        },

        hasMultiplePages(): boolean {
            return this.totalPages > 1;
        },

        isFirstPage(): boolean {
            return this.currentPage === 1;
        },

        isLastPage(): boolean {
            return this.currentPage === this.totalPages;
        },

        isPrevPageAccessible(): boolean {
            return this.isPageAccessible(this.currentPage - 1);
        },

        isNextPageAccessible(): boolean {
            return this.isPageAccessible(this.currentPage + 1);
        },

        countMessage(): string {
            const { __, currentPage, totalPages, totalItems, perPage } = this;

            const from = (currentPage - 1) * perPage + 1;
            const to = currentPage !== totalPages
                ? from + perPage - 1
                : totalItems;

            const values = __('count', {
                count: formatNumber(totalItems),
                from: formatNumber(from),
                to: formatNumber(to),
            });

            const parts = values.split('|');
            const partIndex = Math.min(
                totalItems === 1 ? 2 : (totalPages === 1 ? 1 : 0),
                parts.length - 1,
            );
            return parts[partIndex];
        },
    },
    watch: {
        currentPage(newPage: number) {
            if (!this.isPageAccessible(newPage)) {
                return;
            }
            const maxFirstPage = Math.max(1, this.totalPages - PAGINATION_CHUNK + 1);

            // - On recale `chunkFirstPage` dans l'intervalle des possibles si celui-ci est hors limite.
            this.chunkFirstPage = Math.min(Math.max(1, this.chunkFirstPage), maxFirstPage);

            const minPage = Math.max(1, newPage - 1);
            if (!this.currentChunkPages.includes(minPage)) {
                this.chunkFirstPage = Math.min(minPage, maxFirstPage);
                return;
            }

            const maxPage = Math.min(this.totalPages, newPage + 1);
            if (!this.currentChunkPages.includes(maxPage)) {
                const first = maxPage - PAGINATION_CHUNK + 1;
                this.chunkFirstPage = Math.max(first, 1);
            }
        },
        totalPages() {
            // - On recale `chunkFirstPage` dans l'intervalle des possibles si celui-ci est hors limite.
            const maxFirstPage = Math.max(1, this.totalPages - PAGINATION_CHUNK + 1);
            this.chunkFirstPage = Math.min(Math.max(1, this.chunkFirstPage), maxFirstPage);

            // - Si la page courante n'est pas dans l'intervalle affiché, on déplace celui-ci.
            const currentEnd = Math.min(this.totalPages, this.chunkFirstPage + PAGINATION_CHUNK - 1);
            if (this.currentPage < this.chunkFirstPage) {
                this.chunkFirstPage = Math.max(1, this.currentPage - 1);
            } else if (this.currentPage > currentEnd) {
                this.chunkFirstPage = Math.max(1, this.currentPage - PAGINATION_CHUNK + 2);
            }
        },
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handlePrev() {
            const newPage = this.currentPage - 1;
            if (!this.isPageAccessible(newPage)) {
                return;
            }
            this.setPage(newPage);
        },

        handleNext() {
            const newPage = this.currentPage + 1;
            if (!this.isPageAccessible(newPage)) {
                return;
            }
            this.setPage(newPage);
        },

        handleChangePage(newPage: number) {
            if (!this.isPageAccessible(newPage)) {
                return;
            }
            this.setPage(newPage);
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        setPage(page: number) {
            if (!this.isPageAccessible(page) || this.currentPage === page) {
                return;
            }
            this.$emit('change', page);
        },

        isPageAccessible(page: number): boolean {
            return page >= 1 && page <= this.totalPages;
        },

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            key = !key.startsWith('global.')
                ? `components.Pagination.${key}`
                : key.replace(/^global\./, '');

            return this.$t(key, params, count);
        },
    },
    render() {
        const {
            __,
            currentChunkPages,
            currentPage,
            countMessage,
            hasMultiplePages,
            isPrevPageAccessible,
            isNextPageAccessible,
            hasItems,
            handlePrev,
            handleNext,
            handleChangePage,
        } = this;

        if (!hasItems) {
            return null;
        }

        const className = ['Pagination', {
            'Pagination--paginated': hasMultiplePages,
        }];

        return (
            <div class={className}>
                {hasMultiplePages && (
                    <ul class="Pagination__pagination">
                        <li
                            class={[
                                'Pagination__pagination__item',
                                'Pagination__pagination__item--prev-page',
                                { 'Pagination__pagination__item--disabled': !isPrevPageAccessible },
                            ]}
                        >
                            <button
                                type="button"
                                class="Pagination__pagination__item__button"
                                disabled={!isPrevPageAccessible}
                                onClick={handlePrev}
                            >
                                {__('previous')}
                            </button>
                        </li>
                        {currentChunkPages.map((_page: number) => {
                            const isActive = currentPage === _page;
                            return (
                                <li
                                    key={_page}
                                    class={[
                                        'Pagination__pagination__item',
                                        'Pagination__pagination__item--page',
                                        { 'Pagination__pagination__item--active': isActive },
                                    ]}
                                >
                                    <button
                                        type="button"
                                        class="Pagination__pagination__item__button"
                                        onClick={() => { handleChangePage(_page); }}
                                    >
                                        {formatNumber(_page)}
                                    </button>
                                </li>
                            );
                        })}
                        <li
                            class={[
                                'Pagination__pagination__item',
                                'Pagination__pagination__item--next-page',
                                { 'Pagination__pagination__item--disabled': !isNextPageAccessible },
                            ]}
                        >
                            <button
                                type="button"
                                class="Pagination__pagination__item__button"
                                disabled={!isNextPageAccessible}
                                onClick={handleNext}
                            >
                                {__('next')}
                            </button>
                        </li>
                    </ul>
                )}
                {hasItems && (
                    <p class="Pagination__count">
                        {countMessage}
                    </p>
                )}
            </div>
        );
    },
});

export default Pagination;
