import { defineComponent } from 'vue';
import { TechniciansViewMode } from '@/stores/api/users';
import MultiSwitch from '@/themes/default/components/MultiSwitch';

import type { PropType } from 'vue';
import type { Option } from '@/themes/default/components/MultiSwitch';

type Props = {
    /** La valeur du mode d'affichage courant. */
    mode: TechniciansViewMode,
};

/**
 * Affiche un toggle qui permet de choisir entre les
 * différents modes d'affichage des techniciens.
 */
const TechniciansViewModeSwitch = defineComponent({
    name: 'TechniciansViewModeSwitch',
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
                    value: TechniciansViewMode.LISTING,
                    icon: 'list',
                    label: __('listing'),
                },
                {
                    value: TechniciansViewMode.TIMELINE,
                    icon: 'stream',
                    label: __('planning'),
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

        handleChange(value: TechniciansViewMode) {
            this.$router.push({ name: `technicians:${value}` });
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            key = !key.startsWith('global.')
                ? `page.technicians.mode-switch.${key}`
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

export default TechniciansViewModeSwitch;
