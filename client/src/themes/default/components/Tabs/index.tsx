import './index.scss';
import { defineComponent } from 'vue';
import TabButton from './TabButton';
import Tab from './Tab';

import type { PropType } from 'vue';

export type TabChangeEvent = {
    /** L'index de l'onglet qui est sur le point d'être sélectionné. */
    index: number,

    /** L'index de l'onglet précédemment sélectionné. */
    prevIndex: number,

    /** Permet d'annuler le comportement par défaut: Le changement de tab. */
    preventDefault(): void,

    /**
     * Permet d'exécuter le changement de tab manuellement si le
     * comportement automatique a été précédemment annulé.
     */
    executeDefault(): void,
};

type Props = {
    /** L'index de l'onglet sélectionné par défaut. */
    defaultIndex?: number,

    /**
     * Les actions contextuelles à afficher, sous la forme d'un tableau d'éléments. *
     * (e.g. `[<a>1</a>, <a>2</a>]`)
     */
    actions?: JSX.Element[],

    /**
     * Fonction appelée lorsque l'onglet est sur le point de changer.
     *
     * @param event - L'événement lié, voir {@link TabChangeEvent}.
     */
    onChange?(event: TabChangeEvent): void,

    /**
     * Fonction appelée lorsque l'onglet sélectionné a changé.
     *
     * @param index - L'index du nouvel onglet sélectionné.
     */
    onChanged?(index: number): void,
};

type Data = {
    selectedIndex: number,
};

/** Un ensemble d'onglets avec une navigation contrôlée. */
const Tabs = defineComponent({
    name: 'Tabs',
    props: {
        defaultIndex: {
            type: Number as PropType<Required<Props>['defaultIndex']>,
            default: 0,
        },
        actions: {
            type: Array as PropType<Props['actions']>,
            default: undefined,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onChange: {
            type: Function as PropType<Props['onChange']>,
            default: undefined,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onChanged: {
            type: Function as PropType<Props['onChanged']>,
            default: undefined,
        },
    },
    emits: ['change', 'changed'],
    data(): Data {
        return {
            selectedIndex: this.defaultIndex,
        };
    },
    methods: {
        async handleSelect(index: number) {
            if (this.selectedIndex === index) {
                return;
            }

            let hasChanged = false;
            const changeTab = (): void => {
                if (hasChanged) {
                    return;
                }

                hasChanged = true;
                this.selectedIndex = index;
                this.$emit('changed', index);
            };

            let defaultPrevented = false;
            const changeEventPayload: TabChangeEvent = {
                index,
                prevIndex: this.selectedIndex,
                preventDefault: () => {
                    if (hasChanged) {
                        throw new Error('Tab has already been changed.');
                    }
                    defaultPrevented = true;
                },
                executeDefault: changeTab,
            };
            this.$emit('change', changeEventPayload);

            if (!defaultPrevented) {
                changeTab();
            }
        },
    },
    render() {
        const { actions, selectedIndex, handleSelect } = this;

        // - Ceci ne peut pas être placé dans un computed, car sinon
        // on perd la réactivité du contenu du panel.
        const tabs = this.$slots.default!.filter((tab: JSX.Element) => (
            (tab.componentOptions!.Ctor as any).extendOptions.name === 'Tab'
        ));

        return (
            <div class="Tabs">
                <ul class="Tabs__header" role="tablist">
                    {tabs.map((tab: JSX.Element, index: number) => (
                        // @ts-expect-error Le prop spreading n'est pas correctement typé par Vue.
                        <TabButton
                            {...{ props: tab.componentOptions!.propsData }}
                            active={selectedIndex === index}
                            onClick={() => { handleSelect(index); }}
                        />
                    ))}
                    {actions && actions.length > 0 && (
                        <div class="Tabs__actions">{actions}</div>
                    )}
                </ul>
                <div class="Tabs__panel" role="tabpanel">
                    {tabs[selectedIndex]}
                </div>
            </div>
        );
    },
});

export { Tabs, Tab };
