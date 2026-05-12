import Country from '@/utils/country';
import { getLocale } from '@/globals/lang';

export default (): void => {
    Country.locale(getLocale());
};
