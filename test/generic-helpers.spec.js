import { splitArrayIntoBatches } from '../helpers/generic-helpers';
import { SAMPLE_DATA_1, SAMPLE_DATA_2, SAMPLE_EMAIL_LIST } from './generic-helpers-sample-data';


describe('splitArrayIntoBatches', () => {
    describe(`Given batch size 2`, () => {
        it(`returns an array with 3 sub-arrays when sample data is ${JSON.stringify(SAMPLE_DATA_1)}`, () => {
            const result = splitArrayIntoBatches(SAMPLE_DATA_1, 2);
            expect(result.length).toBe(3);
            result.forEach((item) => {
                expect(Array.isArray(item)).toBeTruthy();
            });
        });

        it(`returns an array with 3 sub-arrays when sample data is ${JSON.stringify(SAMPLE_DATA_2)}`, () => {
            const result = splitArrayIntoBatches(SAMPLE_DATA_2, 2);
            expect(result.length).toBe(3);
            result.forEach((item) => {
                expect(Array.isArray(item)).toBeTruthy();
            });
        });
    });

    describe(`Given batch size 3`, () => {
        it(`returns an array with 2 sub-arrays when sample data is ${JSON.stringify(SAMPLE_DATA_1)}`, () => {
            const result = splitArrayIntoBatches(SAMPLE_DATA_1, 3);
            expect(result.length).toBe(2);
            result.forEach((item) => {
                expect(Array.isArray(item)).toBeTruthy();
            });
        });

        it(`returns an array with 2 sub-arrays when sample data is ${JSON.stringify(SAMPLE_DATA_2)}`, () => {
            const result = splitArrayIntoBatches(SAMPLE_DATA_2, 3);
            expect(result.length).toBe(2);
            result.forEach((item) => {
                expect(Array.isArray(item)).toBeTruthy();
            });
        });
    });

    describe(`Given batch size 50`, () => {
        it(`returns an array with 1 sub-arrays when sample data is ${JSON.stringify(SAMPLE_DATA_1)}`, () => {
            const result = splitArrayIntoBatches(SAMPLE_DATA_1, 50);
            expect(result.length).toBe(1);
            result.forEach((item) => {
                expect(Array.isArray(item)).toBeTruthy();
            });
        });

        it(`returns an array with 1 sub-arrays when sample data is ${JSON.stringify(SAMPLE_DATA_2)}`, () => {
            const result = splitArrayIntoBatches(SAMPLE_DATA_2, 50);
            expect(result.length).toBe(1);
            result.forEach((item) => {
                expect(Array.isArray(item)).toBeTruthy();
            });
        });

        it(`returns an array with 4 sub arrays if sample data is a long list of ${ SAMPLE_EMAIL_LIST.length } strings`, () => {
            const result = splitArrayIntoBatches(SAMPLE_EMAIL_LIST, 50);
            expect(result.length).toBe(2);
            result.forEach((item) => {
                expect(Array.isArray(item)).toBeTruthy();
            });
        });
    });
});



