import formatEventTechniciansList from '@/utils/formatEventTechniciansList';
import events from '@fixtures/parsed/events';
import Period from '@/utils/period';

describe('formatEventTechniciansList', () => {
    it('returns an empty array when nothing passed', () => {
        [null, undefined, []].forEach((emptyValue: null | undefined | never[]) => {
            const result = formatEventTechniciansList(emptyValue);
            expect(result).toEqual([]);
        });
    });

    it('returns an array of all technicians with their assigned periods', () => {
        const { technicians: eventTechnicians } = events.details(1);
        const result = formatEventTechniciansList(eventTechnicians);
        expect(result).toHaveLength(2);

        // - First technician with 1 assigned period
        expect(result[0].id).toBe(1);
        expect(result[0].name).toBe('Roger Rabbit');
        expect(result[0].phone).toBeNull();
        expect(result[0].periods).toHaveLength(1);

        // - First period of technician 1
        expect(result[0].periods[0].id).toBe(1);
        expect(result[0].periods[0].role?.name).toBe('Régisseur');
        expect(result[0].periods[0].period).toBeInstanceOf(Period);

        // - Second technician with 1 assigned period
        expect(result[1].id).toBe(2);
        expect(result[1].name).toBe('Jean Technicien');
        expect(result[1].phone).toBe('+33645698520');
        expect(result[1].periods).toHaveLength(1);

        // - First period of technician 2
        expect(result[1].periods[0].id).toBe(2);
        expect(result[1].periods[0].role?.name).toBe('Technicien plateau');
        expect(result[1].periods[0].period).toBeInstanceOf(Period);
    });
});
