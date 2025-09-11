import './index.scss';
import { defineComponent } from 'vue';
import Page from '@/themes/default/components/Page';
import Sidebar from './components/Sidebar';

/** Page des paramètres globaux. */
const GlobalSettings = defineComponent({
    name: 'GlobalSettings',
    render() {
        const { $t: __ } = this;

        return (
            <Page name="global-settings" title={__('page.settings.title')}>
                <div class="GlobalSettings">
                    <aside class="GlobalSettings__sidebar">
                        <Sidebar />
                    </aside>
                    <main class="GlobalSettings__body">
                        <router-view key={this.$route.path} />
                    </main>
                </div>
            </Page>
        );
    },
});

export { default as pages } from './pages';
export default GlobalSettings;
