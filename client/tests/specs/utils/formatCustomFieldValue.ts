import formatCustomFieldValue from '@/utils/formatCustomFieldValue';
import materials from '@fixtures/parsed/materials';

import type { I18nTranslate } from 'vuex-i18n';

describe('formatCustomFieldValue', () => {
    const fakeTranslateFn: I18nTranslate = (key: string, params?: Record<string, number | string>, count?: number) => (
        JSON.stringify({ key, params, count })
    );

    it('returns the formatted value of a string custom field', () => {
        const property = materials.default(1).properties[0];
        expect(formatCustomFieldValue(fakeTranslateFn, property)).toBe('Grise');
    });

    it('returns the formatted value of an integer custom field', () => {
        const property = materials.default(1).properties[2];
        expect(formatCustomFieldValue(fakeTranslateFn, property)).toBe(`850\u00A0W`);
    });

    it('returns the formatted value of a float custom field', () => {
        const property = materials.default(1).properties[1];
        expect(formatCustomFieldValue(fakeTranslateFn, property)).toBe(`36.5\u00A0kg`);
    });

    it('returns the formatted value of a date custom field', () => {
        const property = materials.default(6).properties[0];
        expect(formatCustomFieldValue(fakeTranslateFn, property)).toBe('01/28/2021');
    });

    it('returns the formatted value of a boolean custom field', () => {
        const property = materials.default(4).properties[0];
        expect(formatCustomFieldValue(fakeTranslateFn, property)).toBe(JSON.stringify({
            key: 'yes',
        }));
    });

    it('returns the formatted value of a list custom field', () => {
        const property = materials.default(6).properties[1];
        expect(formatCustomFieldValue(fakeTranslateFn, property)).toBe('Polyvalent');
    });
});
