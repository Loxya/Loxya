import './index.scss';
import throttle from 'lodash/throttle';
import { DEBOUNCE_WAIT_DURATION } from '@/globals/constants';
import { defineComponent } from 'vue';
import apiEvents from '@/stores/api/events';
import Icon from '@/themes/default/components/Icon';
import Input from '@/themes/default/components/Input';
import Button from '@/themes/default/components/Button';
import Result from './Result';

import type { DebouncedMethod } from 'lodash';
import type { PropType } from 'vue';
import type { EventSummary } from '@/stores/api/events';

type Props = {
    /** ID d'un événement à ne pas inclure dans la recherche. */
    exclude?: number | null,

    /**
     * Fonction appelée lorsque l'un des résultats est choisi par l'utilisateur.
     *
     * @param id - L'id de l'événement choisi.
     */
    onSelect?(id: EventSummary['id']): void,
};

type InstanceProperties = {
    handleSearchDebounced: (
        | DebouncedMethod<typeof ImportFromEventSearch, 'handleSearch'>
        | undefined
    ),
};

type Data = {
    searchTerm: string,
    totalCount: number,
    results: EventSummary[],
    isLoading: boolean,
    isFetched: boolean,
};

/**
 * Champ de recherche d'un événement dans la modale d'import
 * de matériel depuis un événement.
 */
const ImportFromEventSearch = defineComponent({
    name: 'ImportFromEventSearch',
    props: {
        exclude: {
            type: Number as PropType<Props['exclude']>,
            default: null,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onSelect: {
            type: Function as PropType<Props['onSelect']>,
            default: undefined,
        },
    },
    emits: ['select'],
    setup: (): InstanceProperties => ({
        handleSearchDebounced: undefined,
    }),
    data(): Data {
        return {
            searchTerm: '',
            totalCount: 0,
            results: [],
            isLoading: false,
            isFetched: false,
        };
    },
    mounted() {
        this.handleSearchDebounced = throttle(
            this.handleSearch.bind(this),
            DEBOUNCE_WAIT_DURATION.asMilliseconds(),
        );
    },
    beforeDestroy() {
        this.handleSearchDebounced?.cancel();
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        async handleSearch() {
            const { $t: __, searchTerm } = this;

            const trimmedSearchTerm = searchTerm.trim();
            if (trimmedSearchTerm.length < 2) {
                return;
            }

            this.isLoading = true;

            try {
                const { count, data } = await apiEvents.all({
                    search: trimmedSearchTerm,
                    exclude: this.exclude ?? undefined,
                    onlySelectable: true,
                });
                this.totalCount = count;
                this.results = data;
                this.isFetched = true;
            } catch {
                this.isFetched = false;
                this.$toasted.error(__('errors.unknown'));
            } finally {
                this.isLoading = false;
            }
        },

        handleSelect(id: EventSummary['id']) {
            this.$emit('select', id);
        },

        handleKeyup(e: KeyboardEvent) {
            if (e.code === 'Enter' || e.code === 'NumpadEnter') {
                this.handleSearch();
                return;
            }
            this.handleSearchDebounced!();
        },
    },
    render() {
        const {
            $t: __,
            isLoading,
            isFetched,
            handleSelect,
            handleKeyup,
            handleSearch,
        } = this;

        const renderResults = (): JSX.Element => {
            const { totalCount, results } = this;

            if (results.length === 0) {
                return (
                    <p class="ImportFromEventSearch__no-result">
                        {__('no-result-found-try-another-search')}
                    </p>
                );
            }

            const otherCount = totalCount - results.length;

            return (
                <div class="ImportFromEventSearch__results">
                    <ul class="ImportFromEventSearch__results__list">
                        {results.map((event: EventSummary) => (
                            <Result
                                key={event.id}
                                event={event}
                                onSelect={handleSelect}
                            />
                        ))}
                    </ul>
                    {otherCount > 0 && (
                        <p class="ImportFromEventSearch__results__count">
                            {__('and-count-more-older-events', { count: otherCount }, otherCount)}
                        </p>
                    )}
                </div>
            );
        };

        return (
            <div class="ImportFromEventSearch">
                <div class="ImportFromEventSearch__search">
                    <Input
                        type="text"
                        value={this.searchTerm}
                        placeholder={__('type-to-search-event')}
                        class="ImportFromEventSearch__search__input"
                        onKeyup={handleKeyup}
                        onInput={(value: string) => {
                            this.searchTerm = value;
                        }}
                    />
                    <Button
                        type="primary"
                        class="ImportFromEventSearch__search__button"
                        onClick={handleSearch}
                        disabled={isLoading}
                    >
                        {(
                            isLoading
                                ? <Icon name="spinner" spin />
                                : <Icon name="search" />
                        )}
                    </Button>
                </div>
                {isFetched && (
                    <div class="ImportFromEventSearch__response">
                        {renderResults()}
                    </div>
                )}
            </div>
        );
    },
});

export default ImportFromEventSearch;
