import config from '@/globals/config';
import { AVAILABLE_LANGUAGES } from './@constants';

export { AVAILABLE_LANGUAGES };

/**
 * Permet de récupérer la langue par défaut de l'application.
 *
 * @returns - La par défaut de l'application.
 */
export const getDefaultLang = (): string => config.defaultLang;

/**
 * Permet de récupérer la langue actuelle.
 *
 * @returns - La langue actuelle.
 */
export const getLang = (): string => {
    const userLang = localStorage.getItem('userLocale');
    if (userLang && Object.keys(AVAILABLE_LANGUAGES).includes(userLang)) {
        return userLang;
    }
    return getDefaultLang();
};

/**
 * Permet de récupérer la locale actuelle.
 *
 * @returns - La locale actuelle.
 */
export const getLocale = (): string => {
    const lang = getLang();
    return AVAILABLE_LANGUAGES[lang] ?? lang;
};
