import createEntityStore from '@/utils/createEntityStore';
import apiTags from '@/stores/api/tags';

import type { RootState } from '.';
import type { EntityState } from '@/utils/createEntityStore';
import type { Tag } from '@/stores/api/tags';

export type State = EntityState<Tag>;

export default createEntityStore<Tag, RootState>(
    () => apiTags.all(),
    {
        tagName: (state: State) => (
            (id: Tag['id']): string | null => {
                const tag = state.list.find((_tag) => _tag.id === id);
                return tag?.name ?? null;
            }
        ),
    },
);
