import './index.scss';
import { defineComponent } from 'vue';

import type { PropType } from 'vue';
import type { Tag } from '@/stores/api/tags';

type Props = {
    /** Les tags à afficher. */
    tags: Tag[],
};

/** Liste de tags. */
const TagsList = defineComponent({
    name: 'TagsList',
    props: {
        tags: {
            type: Array as PropType<Required<Props>['tags']>,
            required: true,
        },
    },
    render() {
        const { tags } = this;

        return (
            <ul class="TagsList">
                {tags.map(({ id, name }: Tag) => (
                    <li key={id} class="TagsList__item">
                        {name}
                    </li>
                ))}
            </ul>
        );
    },
});

export default TagsList;
