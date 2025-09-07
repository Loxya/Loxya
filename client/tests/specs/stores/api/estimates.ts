import { EstimateSchema } from '@/stores/api/estimates';
import data from '@fixtures/estimates';

import type { SafeParseSuccess } from 'zod';

describe('Estimates Api', () => {
    it('has a valid schema', () => {
        data.default().forEach((datum: any) => {
            const result = EstimateSchema.safeParse(datum);
            expect(result.success).toBeTruthy();
            expect((result as SafeParseSuccess<unknown>).data).toMatchSnapshot();
        });
    });
});
