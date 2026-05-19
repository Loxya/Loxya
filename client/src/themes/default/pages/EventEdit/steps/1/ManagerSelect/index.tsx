import { defineComponent } from 'vue';
import debounce from 'lodash/debounce';
import { DEBOUNCE_WAIT_DURATION } from '@/globals/constants';
import formatOptions from '@/utils/formatOptions';
import apiUsers from '@/stores/api/users';
import Select from '@/themes/default/components/Select';

import type { DebouncedMethod } from 'lodash';
import type { PropType } from 'vue';
import type { Options } from '@/utils/formatOptions';
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

        handleChange(value: User['id'] | null) {
            this.value = value;
            this.$emit('change', value);
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        async search(search: string): Promise<void> {
            try {
                const { data } = await apiUsers.all({ search, limit: 20 });
                this.list = data;
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error(`Error while searching a user (term: "${search}").`, error);
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
            value,
            options,
            debouncedSearch,
            handleChange,
        } = this;

        return (
            <Select
                value={value}
                options={options}
                searcher={debouncedSearch}
                onInput={handleChange}
                placeholder={__('global.start-typing-to-search')}
                noOptionsRenderer={(search: string) => (
                    search.length === 0
                        ? __('placeholder-help')
                        : null
                )}
            />
        );
    },
});

export default EventEditStepInfosManagerSelect;
