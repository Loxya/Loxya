import { defineComponent } from 'vue';
import debounce from 'lodash/debounce';
import VueSelect from 'vue-select';
import { DEBOUNCE_WAIT_DURATION } from '@/globals/constants';
import formatOptions from '@/utils/formatOptions';
import apiUsers from '@/stores/api/users';

import type { DebouncedMethod } from 'lodash';
import type { PropType } from 'vue';
import type { Options, Option } from '@/utils/formatOptions';
import type { User } from '@/stores/api/users';

type Props = {
    /**
     * L'utilisateur pré-sélectionné à l'affichage
     * de la liste de sélection du chef de projet.
     */
    defaultValue?: User | null,

    /**
     * Fonction appelée lorsque le chef de projet sélectionné change.
     *
     * @param id - Identifiant de l'utilisateur sélectionné, ou `null` si aucun.
     */
    onChange?(id: User['id'] | null): void,
};

type InstanceProperties = {
    debouncedSearch: (
        | DebouncedMethod<typeof EventEditStepInfosManagerSelect, 'search'>
        | undefined
    ),
};

type Data = {
    list: User[],
    value: User['id'] | null,
};

/** Longueur minimale du texte lors d'une recherche. */
const MIN_SEARCH_CHARACTERS = 2;

/** Champ de formulaire de sélection du chef de projet. */
const EventEditStepInfosManagerSelect = defineComponent({
    name: 'EventEditStepInfosManagerSelect',
    props: {
        defaultValue: {
            type: Object as PropType<Required<Props>['defaultValue']>,
            default: null,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onChange: {
            type: Function as PropType<Props['onChange']>,
            default: undefined,
        },
    },
    emits: ['change'],
    setup: (): InstanceProperties => ({
        debouncedSearch: undefined,
    }),
    data(): Data {
        const { defaultValue } = this;

        return {
            value: defaultValue?.id ?? null,
            list: defaultValue ? [defaultValue] : [],
        };
    },
    computed: {
        selected(): Option<User> | null {
            const { options, value } = this;

            if (value === null) {
                return null;
            }

            const option = options.find((_option: Option<User>) => (
                _option.value.toString() === value.toString()
            ));

            return option ?? null;
        },

        options(): Options<User> {
            const { list } = this;

            return formatOptions(list, (user: User) => user.full_name);
        },
    },
    created() {
        this.debouncedSearch = debounce(
            this.search.bind(this),
            DEBOUNCE_WAIT_DURATION.asMilliseconds(),
        );
    },
    beforeDestroy() {
        this.debouncedSearch?.cancel();
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleSearch(search: string, setLoading: (isLoading: boolean) => void) {
            if (search.length < MIN_SEARCH_CHARACTERS) {
                return;
            }
            setLoading(true);
            this.debouncedSearch!(search, setLoading);
        },

        handleChange(selection: Option<User> | null) {
            const { value } = selection ?? { value: null };

            this.value = value;
            this.$emit('change', value);
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        async search(search: string, setLoading: (isLoading: boolean) => void) {
            try {
                const { data } = await apiUsers.all({ search, limit: 20 });
                this.list = data;
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error(`Error while searching a user (term: "${search}").`, error);
            } finally {
                setLoading(false);
            }
        },

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            key = !key.startsWith('global.')
                ? `page.event-edit.steps.informations.project-manager.${key}`
                : key.replace(/^global\./, '');

            return this.$t(key, params, count);
        },
    },
    render() {
        const {
            __,
            selected,
            options,
            handleSearch,
            handleChange,
        } = this;

        return (
            <VueSelect
                value={selected}
                options={options}
                filterable={false}
                multiple={false}
                onSearch={handleSearch}
                onInput={handleChange}
                placeholder={__('global.start-typing-to-search')}
                scopedSlots={{
                    'no-options': ({ search }: { search: string }) => {
                        if (search.length === 0) {
                            return __('placeholder-help');
                        }

                        if (search.length > 0 && search.length < MIN_SEARCH_CHARACTERS) {
                            return __(
                                'global.type-at-least-count-chars-to-search',
                                { count: MIN_SEARCH_CHARACTERS - search.length },
                                MIN_SEARCH_CHARACTERS - search.length,
                            );
                        }

                        return __('global.no-result-found-try-another-search');
                    },
                }}
            />
        );
    },
});

export default EventEditStepInfosManagerSelect;
