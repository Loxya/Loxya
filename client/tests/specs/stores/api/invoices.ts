import { InvoiceSchema } from '@/stores/api/invoices';
import data from '@fixtures/invoices';

import type { SafeParseSuccess } from 'zod';

describe('Invoices Api', () => {
    it('has a valid schema', () => {
        data.default().forEach((datum: any) => {
            const result = InvoiceSchema.safeParse(datum);
            expect(result.success).toBeTruthy();
            expect((result as SafeParseSuccess<unknown>).data).toMatchSnapshot();
        });
    });
});
