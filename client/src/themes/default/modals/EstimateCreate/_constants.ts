/* eslint-disable import/prefer-default-export */

import type { InjectionKey } from 'vue';
import type { Step } from './steps';

/** Clé d'injection pour la fonction de navigation entre étapes. */
export const GoToStepKey: InjectionKey<(step: Step) => void> = (
    Symbol('EstimateCreate.go-to-step')
);
