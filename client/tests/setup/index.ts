/* eslint-disable jest/require-hook */

import './globals';

import { init as initRawDateTime } from '@/globals/rawDatetime';
import { init as initRequester } from '@/globals/requester';
import initCountry from '@/globals/init/country';
import initMoment from '@/globals/init/moment';

// - Initialisation.
initMoment();
initCountry();
initRawDateTime();
initRequester();
