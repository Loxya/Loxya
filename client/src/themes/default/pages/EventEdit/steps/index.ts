import Step1 from './1';
import Step2 from './2';
import Step3 from './3';
import Step4 from './4';
import Step5 from './5';
import Step6 from './6';

import type { RawComponent } from 'vue';

export enum Step {
    INFORMATIONS = 1,
    BENEFICIARIES = 2,
    TECHNICIANS = 3,
    MATERIALS = 4,
    BILLING = 5,
    SUMMARY = 6,
}

export default new Map<Step, RawComponent>([
    [Step.INFORMATIONS, Step1],
    [Step.BENEFICIARIES, Step2],
    [Step.TECHNICIANS, Step3],
    [Step.MATERIALS, Step4],
    [Step.BILLING, Step5],
    [Step.SUMMARY, Step6],
]);
