import config from '@/globals/config';
import DateTime from '@/utils/datetime';

import type { Duration } from '@/utils/datetime';

/**
 * Delta a ajouter lors d'un fetch de techniciens.
 *
 * Ceci pour éviter que l'utilisateur ne se retrouve sans données au
 * moindre scroll horizontal.
 */
export const FETCH_DELTA: Duration = DateTime.duration(3, 'days');

/**
 * Interval de temps minimum affiché dans le calendrier.
 * (Il ne sera pas possible d'augmenter le zoom au delà de cette limite)
 */
export const MIN_ZOOM: Duration = DateTime.duration(1, 'hour');

/**
 * Interval de temps maximum affiché dans le calendrier.
 * (Il ne sera pas possible de dé-zoomer au delà de cette limite)
 */
export const MAX_ZOOM: Duration = DateTime.duration(config.maxFetchPeriod, 'days');

/**
 * Nom de la clé de local storage dans laquelle sera
 * persisté la période de la timeline techniciens.
 */
export const TIMELINE_PERIOD_STORAGE_KEY: string = 'technicianTimelinePeriod';
