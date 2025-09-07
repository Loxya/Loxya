import './index.scss';
import { defineComponent } from 'vue';

const DropdownTransition = defineComponent({
    name: 'DropdownTransition',
    render() {
        const children = this.$slots.default;

        return (
            <div>
                <transition
                    name="DropdownTransition"
                    enterClass="DropdownTransition--enter"
                    enterActiveClass="DropdownTransition--enter-active"
                    enterToClass="DropdownTransition--enter-entered"
                    leaveClass="DropdownTransition--leave"
                    leaveActiveClass="DropdownTransition--leave-active"
                    leaveToClass="DropdownTransition--leave-leaved"
                >
                    {children}
                </transition>
            </div>
        );
    },
});

export default DropdownTransition;
