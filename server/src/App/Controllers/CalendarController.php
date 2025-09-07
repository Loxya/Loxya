<?php
declare(strict_types=1);

namespace Loxya\Controllers;

use Carbon\Carbon;
use Carbon\CarbonImmutable;
use DI\Container;
use Eluceo\iCal\Domain\Entity\Calendar;
use Eluceo\iCal\Domain\Entity\Event as CalendarEvent;
use Eluceo\iCal\Domain\Entity\TimeZone as CalendarTimeZone;
use Eluceo\iCal\Domain\ValueObject as CalendarValue;
use Eluceo\iCal\Presentation\Factory\CalendarFactory;
use Fig\Http\Message\StatusCodeInterface as StatusCode;
use Illuminate\Database\Eloquent\Builder;
use Loxya\Config\Config;
use Loxya\Http\Request;
use Loxya\Models\Enums\PublicCalendarPeriodDisplay;
use Loxya\Models\Event;
use Loxya\Models\Setting;
use Loxya\Services\I18n;
use Loxya\Support\Period;
use Psr\Http\Message\ResponseInterface;
use Slim\Exception\HttpNotFoundException;
use Slim\Http\Response;
use Slim\Psr7\Factory\StreamFactory;

final class CalendarController extends BaseController
{
    private I18n $i18n;

    public function __construct(Container $container, I18n $i18n)
    {
        parent::__construct($container);

        $this->i18n = $i18n;
    }

    public function public(Request $request, Response $response): ResponseInterface
    {
        $uuid = $request->getAttribute('uuid');
        $settings = Setting::getWithKey('calendar.public');
        if (!$settings['enabled'] || !$uuid || $uuid !== $settings['uuid']) {
            throw new HttpNotFoundException($request);
        }

        $calendarEvents = [];
        $calendarBoundaries = ['start' => null, 'end' => null];

        $baseUri = Config::getBaseUri();
        $minDate = new CarbonImmutable('3 months ago 00:00:00');

        $addCalendarEvent = static function (
            string $uriPath,
            string $title,
            Period $period,
            \DateTimeInterface|string $lastUpdate,
            ?callable $callback = null,
        ) use (
            &$calendarBoundaries,
            &$calendarEvents,
            $baseUri,
        ) {
            if (!$calendarBoundaries['start'] || $period->getStartDate() < $calendarBoundaries['start']) {
                $calendarBoundaries['start'] = $period->getStartDate();
            }
            if (!$calendarBoundaries['end'] || $period->getEndDate() > $calendarBoundaries['end']) {
                $calendarBoundaries['end'] = $period->getEndDate();
            }

            $calendarEventId = new CalendarValue\UniqueIdentifier(
                md5((string) $baseUri->withPath($uriPath)),
            );
            $calendarEvent = (new CalendarEvent($calendarEventId))
                ->setOccurrence($period->toCalendarOccurrence())
                ->setSummary($title);

            if ($callback !== null) {
                $callback($calendarEvent);
            }

            $calendarEvents[] = $calendarEvent->touch(new CalendarValue\Timestamp($lastUpdate));
        };

        //
        // - Événements.
        //

        $events = Event::query()
            ->tap(static function (Builder $query) use ($settings, $minDate) {
                switch ($settings['displayedPeriod']) {
                    case PublicCalendarPeriodDisplay::BOTH->value:
                        return $query
                            ->where(static function (Builder $subQuery) use ($minDate) {
                                $subQuery
                                    ->orWhere('operation_end_date', '>', $minDate)
                                    ->orWhere('mobilization_end_date', '>', $minDate);
                            })
                            ->orderBy('mobilization_start_date', 'asc')
                            ->orderBy('operation_start_date', 'asc');

                    case PublicCalendarPeriodDisplay::OPERATION->value:
                        return $query
                            ->where('operation_end_date', '>', $minDate)
                            ->orderBy('operation_start_date', 'asc');

                    case PublicCalendarPeriodDisplay::MOBILIZATION->value:
                        return $query
                            ->where('mobilization_end_date', '>', $minDate)
                            ->orderBy('mobilization_start_date', 'asc');

                    default:
                        throw new \LogicException(sprintf(
                            "Unknown period display mode for public calendar: `%s`",
                            $settings['displayedPeriod'],
                        ));
                }
            })
            ->where('is_archived', false)
            ->get();

        foreach ($events as $event) {
            $lastUpdate = $event->updated_at ?? $event->created_at;

            // - Période d'opération.
            $shouldDisplayOperationPeriod = (
                $settings['displayedPeriod'] === PublicCalendarPeriodDisplay::BOTH->value ||
                $settings['displayedPeriod'] === PublicCalendarPeriodDisplay::OPERATION->value
            );
            if ($shouldDisplayOperationPeriod) {
                $addCalendarEvent(
                    sprintf('/event/%d', $event->id),
                    (
                        $settings['displayedPeriod'] === PublicCalendarPeriodDisplay::BOTH->value
                            ? $this->i18n->translate('label-with-period-flag.operation', $event->title)
                            : $event->title
                    ),
                    $event->operation_period,
                    $lastUpdate,
                    static function (CalendarEvent $calendarEvent) use ($event) {
                        if (!empty($event->description)) {
                            $calendarEvent->setDescription($event->description);
                        }
                        if (!empty($event->location)) {
                            $calendarEvent->setLocation(new CalendarValue\Location($event->location));
                        }
                    },
                );
            }

            // - Période de mobilisation.
            $shouldDisplayMobilizationPeriod = (
                $settings['displayedPeriod'] === PublicCalendarPeriodDisplay::BOTH->value ||
                $settings['displayedPeriod'] === PublicCalendarPeriodDisplay::MOBILIZATION->value
            );
            if ($shouldDisplayMobilizationPeriod) {
                $addCalendarEvent(
                    sprintf('/event/%d?period=mobilization', $event->id),
                    (
                        $settings['displayedPeriod'] === PublicCalendarPeriodDisplay::BOTH->value
                            ? $this->i18n->translate('label-with-period-flag.mobilization', $event->title)
                            : $event->title
                    ),
                    $event->mobilization_period,
                    $lastUpdate,
                    static function (CalendarEvent $calendarEvent) use ($event) {
                        if (!empty($event->description)) {
                            $calendarEvent->setDescription($event->description);
                        }
                        if (!empty($event->location)) {
                            $calendarEvent->setLocation(new CalendarValue\Location($event->location));
                        }
                    },
                );
            }
        }

        //
        // - Rendu.
        //

        $timeZone = CalendarTimeZone::createFromPhpDateTimeZone(
            new \DateTimeZone(@date_default_timezone_get()),
            $calendarBoundaries['start'] ?? Carbon::today()->startOfDay(),
            $calendarBoundaries['end'] ?? Carbon::tomorrow()->startOfDay(),
        );

        $calendar = (new Calendar($calendarEvents))
            ->addTimeZone($timeZone);

        // - Specifies a suggested iCalendar file download frequency for clients with sync capabilities.
        // @see https://learn.microsoft.com/en-us/openspecs/exchange_server_protocols/ms-oxcical/1fc7b244-ecd1-4d28-ac0c-2bb4df855a1f
        $calendar->setPublishedTTL(new \DateInterval('PT5M'));

        return $response
            ->withStatus(StatusCode::STATUS_OK)
            ->withFile(
                (new StreamFactory())->createStream(
                    (string) (new CalendarFactory())->createCalendar($calendar),
                ),
                'text/calendar',
            );
    }
}
