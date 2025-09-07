import { defineComponent } from 'vue';
import { BookingsViewMode } from '@/stores/api/users';
import MultiSwitch from '@/themes/default/components/MultiSwitch';

import type { PropType } from 'vue';
import type { Option } from '@/themes/default/components/MultiSwitch';

type Props = {
    /** La valeur du mode d'affichage courant. */
    mode: BookingsViewMode,
};

/** Affiche un toggle qui permet de choisir entre deux modes d'affichage. */
const BookingsViewModeSwitch = defineComponent({
    name: 'BookingsViewModeSwitch',
    props: {
        mode: {
            type: String as PropType<Props['mode']>,
            required: true,
        },
    },
    computed: {
        options(): Option[] {
            const { __ } = this;

            return [
                {
                    value: BookingsViewMode.CALENDAR,
                    icon: 'calendar-alt',
                    label: __('calendar'),
                },
                {
                    value: BookingsViewMode.LISTING,
                    icon: 'list',
                    label: __('listing'),
                },
            ];
        },
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleChange(value: BookingsViewMode) {
            this.$router.push({ name: `schedule:${value}` });
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            key = !key.startsWith('global.')
                ? `page.schedule.mode-switch.${key}`
                : key.replace(/^global\./, '');

            return this.$t(key, params, count);
        },
    },
    render() {
        const { options, mode, handleChange } = this;

        return (
            <MultiSwitch
                options={options}
                value={mode}
                onChange={handleChange}
            />
        );
    },
});

export default BookingsViewModeSwitch;
