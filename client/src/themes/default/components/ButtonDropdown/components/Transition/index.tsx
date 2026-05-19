import './index.scss';
import { defineComponent } from 'vue';

const ButtonDropdownTransition = defineComponent({
    name: 'ButtonDropdownTransition',
    render() {
        const children = this.$slots.default;

        return (
            <div>
                <transition
                    name="ButtonDropdownTransition"
                    enterClass="ButtonDropdownTransition--enter"
                    enterActiveClass="ButtonDropdownTransition--enter-active"
                    enterToClass="ButtonDropdownTransition--enter-entered"
                    leaveClass="ButtonDropdownTransition--leave"
                    leaveActiveClass="ButtonDropdownTransition--leave-active"
                    leaveToClass="ButtonDropdownTransition--leave-leaved"
                >
                    {children}
                </transition>
            </div>
        );
    },
});

export default ButtonDropdownTransition;
