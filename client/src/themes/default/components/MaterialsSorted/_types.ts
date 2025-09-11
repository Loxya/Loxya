import type {
    EventMaterial,
    EventExtra,
} from '@/stores/api/events';

export type EmbeddedMaterial = (
    | EventMaterial
);

export type EmbeddedExtra = (
    | EventExtra
);
