import './index.scss';
import { defineComponent } from 'vue';
import Icon from '@/themes/default/components/Icon';

/** Icône de l'indicateur d'ouverture du champ de formulaire de type sélecteur. */
const SelectIconOpenIndicator = defineComponent({
    name: 'SelectIconOpenIndicator',
    render() {
        return (
            <Icon
                class="SelectIconOpenIndicator"
                name="caret-down"
            />
        );
    },
});

export default SelectIconOpenIndicator;
