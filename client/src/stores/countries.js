import createEntityStore from '@/utils/createEntityStore';
import apiCountries from '@/stores/api/countries';

export default createEntityStore(
    () => apiCountries.all(),
);
