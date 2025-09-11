import Fragment from '../Fragment';
import { defineComponent } from 'vue';

import type { PropType } from 'vue';

export type TagFunction = (content: string) => JSX.Element;

// @see https://regex101.com/r/qhlJ6f/1
const PLACEHOLDER_REGEX = /<(?<tag>\w+)>(?<content>.*?)<\/\k<tag>>/gs;

type Props = {
    /** La chaîne contenant les balises à remplacer. */
    text: string,

    /**
     * Dictionnaire des remplacements. La clé correspond au nom de balise
     * (ex. `'terms'` pour la balise `<terms>`), la valeur est une fonction
     * qui transforme le contenu.
     */
    placeholders: Record<string, TagFunction>,
};

/**
 * Interpole dynamiquement du contenu dans une chaîne de texte.
 *
 * Pour chaque balise trouvée dans `text`, utilise la fonction correspondante
 * dans `placeholders` pour générer un composant avec le contenu associé.
 *
 * @example
 * ```tsx
 * <Interpolated
 *     text="Cliquez sur <link>ce lien</link> pour voir notre site."
 *     placeholders={{ link: (text: string) => <a href="https://loxya.com">{text}</a> }}
 * />
 * ```
 */
const Interpolated = defineComponent({
    name: 'Interpolated',
    props: {
        text: {
            type: String as PropType<Props['text']>,
            required: true,
        },
        placeholders: {
            type: Object as PropType<Props['placeholders']>,
            required: true,
        },
    },
    computed: {
        parsed(): Array<JSX.Element | string> {
            const { text, placeholders } = this;

            const output: Array<JSX.Element | string> = [];

            const cursor: number = [...text.matchAll(PLACEHOLDER_REGEX)].reduce(
                (_cursor: number, { 0: full, index, groups }: RegExpExecArray) => {
                    const { tag, content } = groups!;

                    // - Texte avant la balise.
                    if (index > _cursor) {
                        output.push(this.text.slice(_cursor, index));
                    }

                    const renderer = placeholders[tag];
                    if (typeof renderer === 'function') {
                        output.push(renderer(content));
                    } else {
                        if (process.env.NODE_ENV === 'development') {
                            // eslint-disable-next-line no-console
                            console.warn(`<Interpolated>: No renderer for tag: <${tag}>.`);
                        }
                        output.push(content);
                    }

                    return index + full.length;
                },
                0,
            );

            // - Texte après la dernière balise.
            if (cursor < this.text.length) {
                output.push(this.text.slice(cursor));
            }

            return output;
        },
    },
    render() {
        return <Fragment>{this.parsed}</Fragment>;
    },
});

export default Interpolated;
