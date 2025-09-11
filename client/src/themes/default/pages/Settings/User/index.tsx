import './index.scss';
import { defineComponent } from 'vue';
import { Tabs, Tab } from '@/themes/default/components/Tabs';
import Page from '@/themes/default/components/Page';

// - Tabs
import ProfileSettings from './tabs/Profile';
import InterfaceSettings from './tabs/Interface';

/** Page des paramètres de l'utilisateur connecté. */
const UserSettings = defineComponent({
    name: 'UserSettings',
    render() {
        const { $t: __ } = this;

        return (
            <Page name="user-settings" title={__('page.user-settings.title')}>
                <div class="UserSettings">
                    <Tabs>
                        <Tab title={__('page.user-settings.profile.title')} icon="user-alt">
                            <ProfileSettings />
                        </Tab>
                        <Tab title={__('page.user-settings.interface.title')} icon="paint-brush">
                            <InterfaceSettings />
                        </Tab>
                    </Tabs>
                </div>
            </Page>
        );
    },
});

export default UserSettings;
