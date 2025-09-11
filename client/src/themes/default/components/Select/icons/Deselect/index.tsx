import './index.scss';
import { defineComponent } from 'vue';
import Icon from '@/themes/default/components/Icon';

/** Icône de dé-selection du champ de formulaire de type sélecteur. */
const SelectIconDeselect = defineComponent({
    name: 'SelectIconDeselect',
    render() {
        return (
            <Icon
                class="SelectIconDeselect"
                name="times"
            />
        );
    },
});

export default SelectIconDeselect;
