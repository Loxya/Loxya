import './index.scss';
import { defineComponent } from 'vue';

const DefaultLayoutSidebarUserDropdownTransition = defineComponent({
    name: 'DefaultLayoutSidebarUserDropdownTransition',
    render() {
        const children = this.$slots.default;

        return (
            <div>
                <transition
                    name="DefaultLayoutSidebarUserDropdownTransition"
                    enterClass="DefaultLayoutSidebarUserDropdownTransition--enter"
                    enterActiveClass="DefaultLayoutSidebarUserDropdownTransition--enter-active"
                    enterToClass="DefaultLayoutSidebarUserDropdownTransition--enter-entered"
                    leaveClass="DefaultLayoutSidebarUserDropdownTransition--leave"
                    leaveActiveClass="DefaultLayoutSidebarUserDropdownTransition--leave-active"
                    leaveToClass="DefaultLayoutSidebarUserDropdownTransition--leave-leaved"
                >
                    {children}
                </transition>
            </div>
        );
    },
});

export default DefaultLayoutSidebarUserDropdownTransition;
