import config from '@/globals/config';
import DateTime from '@/utils/datetime';

import type { Duration } from '@/utils/datetime';
import type { SnapTime } from '@/themes/default/components/Timeline';

/**
 * Delta a ajouter lors d'un fetch de bookings.
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
 * Nombre de requêtes maximum pour la récupération du matériel
 * manquant envoyées par seconde.
 */
export const MAX_FETCHES_PER_SECOND: number = 15;

/**
 * Précision maximum des bookings du calendrier lors de leur création / édition.
 * => Les nouveaux bookings ou les bookings déplacés le seront toujours
 *    en respectant cette contrainte de temps.
 */
export const SNAP_TIME: SnapTime = { precision: 15, unit: 'minute' };

/**
 * Nom de la clé de local storage dans laquelle sera
 * persisté la période du calendrier.
 */
export const CALENDAR_PERIOD_STORAGE_KEY: string = 'calendarPeriod';
