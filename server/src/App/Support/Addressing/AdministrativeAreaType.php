<?php
declare(strict_types=1);

namespace Loxya\Support\Addressing;

/** Zones administratives */
enum AdministrativeAreaType: string
{
    case AREA = 'area';
    case CANTON = 'canton';
    case COUNTY = 'county';
    case DEPARTMENT = 'department';
    case DISTRICT = 'district';
    case DO_SI = 'do_si';
    case EMIRATE = 'emirate';
    case ISLAND = 'island';
    case PARISH = 'parish';
    case PREFECTURE = 'prefecture';
    case PROVINCE = 'province';
    case REGION = 'region';
    case STATE = 'state';
}
