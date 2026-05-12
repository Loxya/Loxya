import config from '@/globals/config';
import apiTaxes from '@/stores/api/taxes';
import formatOptions from '@/utils/formatOptions';
import createEntityStore from '@/utils/createEntityStore';

import type { RootState } from '.';
import type { Options } from '@/utils/formatOptions';
import type { EntityState } from '@/utils/createEntityStore';
import type { Tax } from '@/stores/api/taxes';

export type State = EntityState<Tax>;

const formatTaxName = (tax: Tax): string => {
    if (tax.is_group) {
        return tax.name;
    }

    const { country } = config.organization;
    return !country.hasSimpleVatSystem && tax.name !== undefined
        ? `${tax.name} (${tax.value.toString()}%)`
        : `${tax.value.toString()}%`;
};

export default createEntityStore<Tax, RootState>(
    () => {
        if (config.organization.isVatExempted) {
            // eslint-disable-next-line no-console
            console.warn(
                'Taxes store should not have been fetched ' +
                'since the organization is VAT exempted.',
            );
            return Promise.resolve([]);
        }
        return apiTaxes.all();
    },
    {
        options: (state: State): Options<Tax> => (
            formatOptions(state.list, formatTaxName)
        ),

        getName: (state: State) => (
            (id: Tax['id']): string | null => {
                const tax = state.list.find((_tax) => _tax.id === id);
                return tax !== undefined ? formatTaxName(tax) : null;
            }
        ),
    },
);
