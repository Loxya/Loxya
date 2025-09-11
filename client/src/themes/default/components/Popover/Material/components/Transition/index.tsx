import './index.scss';
import { defineComponent } from 'vue';

const MaterialPopoverTransition = defineComponent({
    name: 'MaterialPopoverTransition',
    render() {
        const children = this.$slots.default;

        return (
            <div>
                <transition
                    name="MaterialPopoverTransition"
                    enterClass="MaterialPopoverTransition--enter"
                    enterActiveClass="MaterialPopoverTransition--enter-active"
                    enterToClass="MaterialPopoverTransition--enter-entered"
                    leaveClass="MaterialPopoverTransition--leave"
                    leaveActiveClass="MaterialPopoverTransition--leave-active"
                    leaveToClass="MaterialPopoverTransition--leave-leaved"
                >
                    {children}
                </transition>
            </div>
        );
    },
});

export default MaterialPopoverTransition;
