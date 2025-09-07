import './index.scss';
import { defineComponent, markRaw } from 'vue';
import getCSSProperty from '@/utils/getCSSProperty';

import type { PropType, Raw } from 'vue';

type Props = {
    /** Une chaîne de caractères contenant le HTML à afficher. */
    content: string,
};

type Data = {
    container: Raw<Element> | undefined,
};

/** Affiche un contenu HTML dans une iframe en y injectant le style du thème actuel. */
const Embed = defineComponent({
    name: 'Embed',
    props: {
        content: {
            type: String as PropType<Props['content']>,
            required: true,
        },
    },
    data: (): Data => ({
        container: undefined,
    }),
    computed: {
        styledContent(): string {
            const { container, content } = this;
            if (!container) {
                return content;
            }

            const embeddedDocument = (new DOMParser()).parseFromString(content, 'text/html');

            ['background-color', 'color', 'font-size'].forEach((cssProperty: string) => {
                const propertyValue = getCSSProperty(`Embed--${cssProperty}`, container);
                if (propertyValue === '') {
                    return;
                }
                embeddedDocument.body.style.setProperty(cssProperty, propertyValue);
            });

            return embeddedDocument.documentElement.outerHTML;
        },
    },
    mounted() {
        this.container = markRaw(this.$el);
    },
    render() {
        const { styledContent } = this;

        return (
            <iframe
                class="Embed"
                srcdoc={styledContent}
                sandbox="allow-same-origin"
            />
        );
    },
});

export default Embed;
