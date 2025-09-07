import requester from '@/globals/requester';
import apiEvents from '@/stores/api/events';
import documents from '@fixtures/documents';
import invoices from '@fixtures/invoices';
import estimates from '@fixtures/estimates';
import materials from '@fixtures/materials';
import data from '@fixtures/events';
import { withCountedEnvelope } from '@fixtures/@utils';

describe('Events Api', () => {
    describe('all()', () => {
        it('parse the returned data correctly', async () => {
            const countedData = withCountedEnvelope(data.summary());
            jest.spyOn(requester, 'get').mockResolvedValue(countedData);
            await expect(apiEvents.all()).resolves.toMatchSnapshot();
        });
    });

    describe('one()', () => {
        it.each(data.details())('parse the returned data correctly (with #$id)', async (datum: any) => {
            jest.spyOn(requester, 'get').mockResolvedValue(datum);
            await expect(apiEvents.one(datum.id)).resolves.toMatchSnapshot();
        });
    });

    describe('create()', () => {
        it.each(data.details())('parse the returned data correctly (with #$id)', async (datum: any) => {
            jest.spyOn(requester, 'post').mockResolvedValue(datum);
            await expect(apiEvents.create({} as any)).resolves.toMatchSnapshot();
        });
    });

    describe('update()', () => {
        it.each(data.details())('parse the returned data correctly (with #$id)', async (datum: any) => {
            jest.spyOn(requester, 'put').mockResolvedValue(datum);
            await expect(apiEvents.update(datum.id, {} as any)).resolves.toMatchSnapshot();
        });
    });

    describe('updateNote()', () => {
        it.each(data.details())('parse the returned data correctly (with #$id)', async (datum: any) => {
            jest.spyOn(requester, 'put').mockResolvedValue(datum);
            await expect(apiEvents.updateNote(datum.id, 'A note.')).resolves.toMatchSnapshot();
        });
    });

    describe('setConfirmed()', () => {
        it.each(data.details())('parse the returned data correctly (with #$id)', async (datum: any) => {
            jest.spyOn(requester, 'put').mockResolvedValue(datum);
            await expect(apiEvents.setConfirmed(datum.id, true)).resolves.toMatchSnapshot();
        });
    });

    describe('archive()', () => {
        it.each(data.details())('parse the returned data correctly (with #$id)', async (datum: any) => {
            jest.spyOn(requester, 'put').mockResolvedValue(datum);
            await expect(apiEvents.archive(datum.id)).resolves.toMatchSnapshot();
        });
    });

    describe('unarchive()', () => {
        it.each(data.details())('parse the returned data correctly (with #$id)', async (datum: any) => {
            jest.spyOn(requester, 'put').mockResolvedValue(datum);
            await expect(apiEvents.unarchive(datum.id)).resolves.toMatchSnapshot();
        });
    });

    describe('updateDepartureInventory()', () => {
        it.each(data.details())('parse the returned data correctly (with #$id)', async (datum: any) => {
            jest.spyOn(requester, 'put').mockResolvedValue(datum);
            await expect(apiEvents.updateDepartureInventory(datum.id, {} as any)).resolves.toMatchSnapshot();
        });
    });

    describe('finishDepartureInventory()', () => {
        it.each(data.details())('parse the returned data correctly (with #$id)', async (datum: any) => {
            jest.spyOn(requester, 'put').mockResolvedValue(datum);
            await expect(apiEvents.finishDepartureInventory(datum.id, {} as any)).resolves.toMatchSnapshot();
        });
    });

    describe('cancelDepartureInventory()', () => {
        it.each(data.details())('parse the returned data correctly (with #$id)', async (datum: any) => {
            jest.spyOn(requester, 'delete').mockResolvedValue(datum);
            await expect(apiEvents.cancelDepartureInventory(datum.id)).resolves.toMatchSnapshot();
        });
    });

    describe('updateReturnInventory()', () => {
        it.each(data.details())('parse the returned data correctly (with #$id)', async (datum: any) => {
            jest.spyOn(requester, 'put').mockResolvedValue(datum);
            await expect(apiEvents.updateReturnInventory(datum.id, {} as any)).resolves.toMatchSnapshot();
        });
    });

    describe('finishReturnInventory()', () => {
        it.each(data.details())('parse the returned data correctly (with #$id)', async (datum: any) => {
            jest.spyOn(requester, 'put').mockResolvedValue(datum);
            await expect(apiEvents.finishReturnInventory(datum.id, undefined, {} as any)).resolves.toMatchSnapshot();
        });
    });

    describe('cancelReturnInventory()', () => {
        it.each(data.details())('parse the returned data correctly (with #$id)', async (datum: any) => {
            jest.spyOn(requester, 'delete').mockResolvedValue(datum);
            await expect(apiEvents.cancelReturnInventory(datum.id)).resolves.toMatchSnapshot();
        });
    });

    describe('createAssignment()', () => {
        const _data = data.details().flatMap((event: any) => event.technicians);
        it.each(_data)('parse the returned data correctly (with technician assignment #$id)', async (datum: any) => {
            jest.spyOn(requester, 'post').mockResolvedValue(datum);
            await expect(apiEvents.createAssignment(datum.event_id, datum)).resolves.toMatchSnapshot();
        });
    });

    describe('updateAssignment()', () => {
        const _data = data.details().flatMap((event: any) => event.technicians);
        it.each(_data)('parse the returned data correctly (with technician assignment #$id)', async (datum: any) => {
            jest.spyOn(requester, 'put').mockResolvedValue(datum);
            await expect(apiEvents.updateAssignment(datum.event_id, datum.id, {} as any)).resolves.toMatchSnapshot();
        });
    });

    describe('createPosition()', () => {
        const _data = data.details().flatMap((event: any) => event.positions);
        it.each(_data)('parse the returned data correctly (with position #$id)', async (datum: any) => {
            jest.spyOn(requester, 'post').mockResolvedValue(datum);
            await expect(apiEvents.createPosition(datum.event_id, datum)).resolves.toMatchSnapshot();
        });
    });

    describe('duplicate()', () => {
        it.each(data.details())('parse the returned data correctly (with #$id)', async (datum: any) => {
            jest.spyOn(requester, 'post').mockResolvedValue(datum);
            await expect(apiEvents.duplicate(datum.id, {} as any)).resolves.toMatchSnapshot();
        });
    });

    describe('documents()', () => {
        it('parse the returned data correctly', async () => {
            jest.spyOn(requester, 'get').mockResolvedValue(documents.default());
            await expect(apiEvents.documents(1)).resolves.toMatchSnapshot();
        });
    });

    describe('createInvoice()', () => {
        it.each(invoices.default())('parse the returned data correctly (with invoice #$id)', async (datum: any) => {
            jest.spyOn(requester, 'post').mockResolvedValue(datum);
            await expect(apiEvents.createInvoice(1)).resolves.toMatchSnapshot();
        });
    });

    describe('createEstimate()', () => {
        it.each(estimates.default())('parse the returned data correctly (with invoice #$id)', async (datum: any) => {
            jest.spyOn(requester, 'post').mockResolvedValue(datum);
            await expect(apiEvents.createEstimate(1)).resolves.toMatchSnapshot();
        });
    });

    describe('attachDocument()', () => {
        it.each(documents.default())('parse the returned data correctly (with document #$id)', async (datum: any) => {
            jest.spyOn(requester, 'post').mockResolvedValue(datum);
            const fakeFile = new File(['__TEST__'], 'my-document.txt', { type: 'text/plain' });
            await expect(apiEvents.attachDocument(1, fakeFile)).resolves.toMatchSnapshot();
        });
    });

    describe('missingMaterials()', () => {
        it('parse the returned data correctly', async () => {
            const _data = [
                {
                    id: 6,
                    name: `Behringer X Air XR18`,
                    reference: 'XR18',
                    category_id: 1,
                    quantity: 2,
                    quantity_departed: 1,
                    quantity_returned: 1,
                    quantity_returned_broken: 0,
                    quantity_missing: 1,
                    departure_comment: null,
                    unit_replacement_price: '49.99',
                    total_replacement_price: '99.98',
                    material: {
                        ...materials.withContextExcerpt(6),
                        degressive_rate: '30.93',
                        rental_price_period: '1546.19',
                    },
                },
                {
                    id: 7,
                    name: `Voiture 1`,
                    reference: 'V-1',
                    category_id: 3,
                    quantity: 3,
                    quantity_departed: null,
                    quantity_returned: 0,
                    quantity_returned_broken: 0,
                    quantity_missing: 2,
                    departure_comment: null,
                    unit_replacement_price: '32000.00',
                    total_replacement_price: '96000.00',
                    material: {
                        ...materials.withContextExcerpt(7),
                        degressive_rate: '30.75',
                        rental_price_period: '9225.00',
                    },
                },
            ];
            jest.spyOn(requester, 'get').mockResolvedValue(_data);
            await expect(apiEvents.missingMaterials(4)).resolves.toMatchSnapshot();
        });
    });
});
