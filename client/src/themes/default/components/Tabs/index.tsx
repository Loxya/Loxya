import './index.scss';
import { defineComponent } from 'vue';
import TabButton from './TabButton';
import Tab from './Tab';

import type { PropType } from 'vue';

export type TabChangeEvent = {
    /**
     * Identifiant de l'onglet sur le point d'être sélectionné.
     *
     * Correspond à la prop `id` du `<Tab>`, ou `undefined` si non fournie.
     */
    id: number | string | undefined,

    /**
     * Identifiant de l'onglet précédemment sélectionné.
     *
     * Correspond à la prop `id` du `<Tab>`, ou `undefined` si non fournie.
     */
    prevId: number | string | undefined,

    /** Permet d'annuler le comportement par défaut: Le changement de tab. */
    preventDefault(): void,

    /**
     * Permet d'exécuter le changement de tab manuellement si le
     * comportement automatique a été précédemment annulé.
     */
    executeDefault(): void,
};

type Props = {
    /**
     * L'identifiant de l'onglet sélectionné par défaut.
     *
     * Correspond à la prop `id` d'un des `<Tab>`.
     */
    defaultActive?: number | string,

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
     * @param id - L'identifiant du nouvel onglet sélectionné ou `undefined`
     *             si l'onglet ciblé n'a pas d'`id` explicite.
     */
    onChanged?(id: number | string | undefined): void,
};

type Data = {
    selectedIndex: number,
};

/** Un ensemble d'onglets avec une navigation contrôlée. */
const Tabs = defineComponent({
    name: 'Tabs',
    props: {
        defaultActive: {
            type: [Number, String] as PropType<Props['defaultActive']>,
            default: undefined,
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
        // - Si un identifiant d'onglet par défaut a été fourni, on le résout
        //   vers son index visuel dans les onglets actuellement rendus.
        let initialIndex = 0;
        if (this.defaultActive !== undefined) {
            const tabs = this.$slots.default?.filter((tab: JSX.Element) => (
                (tab.componentOptions?.Ctor as any)?.extendOptions?.name === 'Tab'
            )) ?? [];
            const found = tabs.findIndex((tab: JSX.Element) => {
                const id = (tab.componentOptions?.propsData as { id?: string | number } | undefined)?.id;
                return id === this.defaultActive;
            });
            if (found !== -1) {
                initialIndex = found;
            }
        }
        return { selectedIndex: initialIndex };
    },
    methods: {
        async handleSelect(index: number) {
            if (this.selectedIndex === index) {
                return;
            }

            const tabs = this.$slots.default!.filter((tab: JSX.Element) => (
                (tab.componentOptions!.Ctor as any).extendOptions.name === 'Tab'
            ));
            const resolveTabId = (tabIndex: number): number | string | undefined => {
                const rawId = (tabs[tabIndex]?.componentOptions?.propsData as { id?: string | number } | undefined)?.id;
                return typeof rawId === 'number' || typeof rawId === 'string' ? rawId : undefined;
            };

            let hasChanged = false;
            const changeTab = (): void => {
                if (hasChanged) {
                    return;
                }

                hasChanged = true;
                this.selectedIndex = index;
                this.$emit('changed', resolveTabId(index));
            };

            let defaultPrevented = false;
            const changeEventPayload: TabChangeEvent = {
                id: resolveTabId(index),
                prevId: resolveTabId(this.selectedIndex),
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
        //   on perd la réactivité du contenu du panel.
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
