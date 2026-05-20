import frMetadata from './fr';
import beMetadata from './be';
import chMetadata from './ch';
import cdMetadata from './cd';
import gfMetadata from './gf';
import ytMetadata from './yt';
import blMetadata from './bl';
import mfMetadata from './mf';
import pmMetadata from './pm';
import wfMetadata from './wf';
import tfMetadata from './tf';

import type { CountryMetadata } from '../_types';

export default new Map<string, CountryMetadata>([
    ['FR', frMetadata],
    ['BE', beMetadata],
    ['CH', chMetadata],
    ['CD', cdMetadata],
    ['GF', gfMetadata],
    ['YT', ytMetadata],
    ['BL', blMetadata],
    ['MF', mfMetadata],
    ['PM', pmMetadata],
    ['WF', wfMetadata],
    ['TF', tfMetadata],
]);
