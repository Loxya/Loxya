import Step1 from './1';
import Step2 from './2';

import type { RawComponent } from 'vue';

export enum Step {
    BUYER_AND_LINES = 1,
    OTHER_INFORMATIONS = 2,
}

export default new Map<Step, RawComponent>([
    [Step.BUYER_AND_LINES, Step1],
    [Step.OTHER_INFORMATIONS, Step2],
]);
