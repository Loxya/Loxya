<?php
declare(strict_types=1);

namespace Loxya\Support\Addressing;

/** Types de localités */
enum LocalityType: string
{
    case CITY = 'city';
    case DISTRICT = 'district';
    case POST_TOWN = 'post_town';
    case SUBURB = 'suburb';
    case TOWN_CITY = 'town_city';
}
