import './index.scss';
import { defineComponent } from 'vue';
import Logo from '@/components/Logo';

/** Header de la barre latérale du layout par défaut. */
const DefaultLayoutSidebarHeader = defineComponent({
    name: 'DefaultLayoutSidebarHeader',
    render() {
        return (
            <div class="DefaultLayoutSidebarHeader">
                <div
                    ref="main"
                    class="DefaultLayoutSidebarHeader__main"
                >
                    <Logo
                        class={[
                            'DefaultLayoutSidebarHeader__main__logo',
                            'DefaultLayoutSidebarHeader__main__logo--large',
                        ]}
                    />
                    <Logo
                        minimalist
                        class={[
                            'DefaultLayoutSidebarHeader__main__logo',
                            'DefaultLayoutSidebarHeader__main__logo--minimalist',
                        ]}
                    />
                </div>
            </div>
        );
    },
});

export default DefaultLayoutSidebarHeader;
