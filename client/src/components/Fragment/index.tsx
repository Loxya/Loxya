import './index.scss';
import { defineComponent } from 'vue';

/** Un élément permettant d'en grouper d'autres sans élément racine. */
const Fragment = defineComponent({
    name: 'Fragment',
    render() {
        const children = this.$slots.default;

        return (
            <div class="Fragment">
                {children}
            </div>
        );
    },
});

export default Fragment;
