<?php
declare(strict_types=1);

namespace Loxya\Tests;

use Eluceo\iCal\Domain\ValueObject\MultiDay as CalendarMultiDay;
use Eluceo\iCal\Domain\ValueObject\SingleDay as CalendarSingleDay;
use Eluceo\iCal\Domain\ValueObject\TimeSpan as CalendarTimeSpan;
use Illuminate\Support\Carbon;
use Loxya\Models\Event;
use Loxya\Support\Period;

final class PeriodTest extends TestCase
{
    public function testFullDays(): void
    {
        // - Période "pleine" simples.
        $period1 = new Period('2024-01-01', '2024-01-02', true);
        $this->assertSame('2024-01-01 00:00:00', $period1->getStartDate()->format('Y-m-d H:i:s'));
        $this->assertSame('2024-01-03 00:00:00', $period1->getEndDate()->format('Y-m-d H:i:s'));
        $this->assertTrue($period1->isFullDays());

        // - Période "pleine" avec heures spécifiée.
        $period2 = new Period('2024-01-01 14:12:10', '2024-01-02 12:45:00', true);
        $this->assertSame('2024-01-01 00:00:00', $period2->getStartDate()->format('Y-m-d H:i:s'));
        $this->assertSame('2024-01-03 00:00:00', $period2->getEndDate()->format('Y-m-d H:i:s'));
        $this->assertTrue($period2->isFullDays());
    }

    public function testSetFullDays(): void
    {
        $doTest = function (Period $result, array $expected) {
            $result = $result->toArray();
            $this->assertSame($expected[0], $result['start']);
            $this->assertSame($expected[1], $result['end']);
            $this->assertSame($expected[2], $result['isFullDays']);
        };

        // - Avec une période à l'heure près vers une période à l'heure près.
        $doTest(
            (new Period('2024-01-01 14:30:00', '2024-01-02 10:20:00'))->setFullDays(false),
            ['2024-01-01 14:30:00', '2024-01-02 10:20:00', false],
        );

        // - Avec une période en journées entières vers une période en journées entières.
        $doTest(
            (new Period('2024-01-01', '2024-01-02', true))->setFullDays(true),
            ['2024-01-01', '2024-01-02', true],
        );

        // - Avec une heure de fin en milieu de journée.
        $doTest(
            (new Period('2024-01-01 14:30:00', '2024-01-02 10:20:00'))->setFullDays(true),
            ['2024-01-01', '2024-01-02', true],
        );

        // - Avec une heure de fin à `00:00:00` de journée suivante (= Fin de la journée précédente).
        $doTest(
            (new Period('2024-01-01 00:00:00', '2024-01-02 00:00:00'))->setFullDays(true),
            ['2024-01-01', '2024-01-01', true],
        );

        // - Avec une période plusieurs jours.
        $doTest(
            (new Period('2024-01-01', '2024-01-02', true))->setFullDays(false),
            ['2024-01-01 00:00:00', '2024-01-03 00:00:00', false],
        );

        // - Avec une période sur une seule journée.
        $doTest(
            (new Period('2024-01-01', '2024-01-01', true))->setFullDays(false),
            ['2024-01-01 00:00:00', '2024-01-02 00:00:00', false],
        );

        // - Avec une période plusieurs jours.
        $doTest(
            (new Period('2024-01-01', '2024-01-02', true))->setFullDays(false, true),
            ['2024-01-01 12:00:00', '2024-01-02 12:00:00', false],
        );

        // - Avec une période sur une seule journée.
        $doTest(
            (new Period('2024-01-01', '2024-01-01', true))->setFullDays(false, true),
            ['2024-01-01 12:00:00', '2024-01-01 12:00:00', false],
        );
    }

    public function testAsDays(): void
    {
        // - Avec des journées entières (1).
        $period1 = new Period('2024-01-01', '2024-01-02', true);
        $this->assertSame(2, $period1->asDays());

        // - Avec des journées entières (2).
        $period2 = new Period('2024-01-01', '2024-01-01', true);
        $this->assertSame(1, $period2->asDays());

        // - Avec une période à l'heure près (1).
        $period3 = new Period('2024-01-01 14:30:00', '2024-01-02 10:20:00');
        $this->assertSame(2, $period3->asDays());

        // - Avec une période à l'heure près (1).
        $period4 = new Period('2024-01-01 14:30:00', '2024-01-01 15:30:00');
        $this->assertSame(1, $period4->asDays());
    }

    public function testAsHours(): void
    {
        // - Avec des journées entières (1).
        $period1 = new Period('2024-01-01', '2024-01-02', true);
        $this->assertSame(48, $period1->asHours());

        // - Avec des journées entières (2).
        $period2 = new Period('2024-01-01', '2024-01-01', true);
        $this->assertSame(24, $period2->asHours());

        // - Avec une période à l'heure près (1).
        $period3 = new Period('2024-01-01 14:30:00', '2024-01-02 10:20:00');
        $this->assertSame(21, $period3->asHours());

        // - Avec une période à l'heure près (1).
        $period4 = new Period('2024-01-01 14:30:00', '2024-01-01 15:30:00');
        $this->assertSame(2, $period4->asHours());
    }

    public function testContain(): void
    {
        // - Avec une période contenue dans l'autre.
        $period1 = new Period('2024-01-01 14:00:00', '2024-02-01 10:50:00');
        $period2 = new Period('2024-01-01 16:10:59', '2024-02-01 10:00:00');
        $this->assertTrue($period1->contain($period2));

        // - Avec des périodes égales.
        $period3 = new Period('2024-01-01 14:00:00', '2024-02-01 10:50:00');
        $this->assertTrue($period1->contain($period3));
        $this->assertTrue($period3->contain($period1));

        // - Avec une période non contenue dans l'autre : Commence avant / se termine après.
        $period4 = new Period('2024-01-01 10:00:00', '2024-02-01 11:00:00');
        $this->assertFalse($period1->contain($period4));

        // - Avec une période infinie.
        $period5 = new Period('2024-01-01 12:00:00', null);
        $this->assertTrue($period5->contain($period3));
        $this->assertFalse($period5->contain($period4));
        $this->assertFalse($period3->contain($period5));

        // - Avec une période non contenue dans l'autre : Se termine après.
        $period6 = new Period('2024-01-01 14:00:00', '2024-02-01 11:00:00');
        $this->assertFalse($period1->contain($period6));

        // - Avec une période non contenue dans l'autre : Commence avant.
        $period7 = new Period('2024-01-01 12:00:00', '2024-02-01 11:00:00');
        $this->assertFalse($period1->contain($period7));

        // - Avec une période non contenue dans l'autre : Pas en même temps.
        $period8 = new Period('2024-02-01 10:50:00', '2024-02-01 11:00:00');
        $this->assertFalse($period1->contain($period8));

        $period9 = new Period('2024-01-01 12:00:00', '2024-01-01 14:00:00');
        $this->assertFalse($period1->contain($period9));

        $period10 = new Period('2024-02-01 11:00:00', '2024-02-01 12:00:00');
        $this->assertFalse($period1->contain($period10));
    }

    public function testOverlaps(): void
    {
        // - Avec une période contenue dans l'autre.
        $period1 = new Period('2024-01-01 14:00:00', '2024-02-01 10:50:00');
        $period2 = new Period('2024-01-01 16:10:59', '2024-02-01 10:00:00');
        $this->assertTrue($period1->overlaps($period2));

        // - Avec des périodes égales.
        $period3 = new Period('2024-01-01 14:00:00', '2024-02-01 10:50:00');
        $this->assertTrue($period1->overlaps($period3));
        $this->assertTrue($period3->overlaps($period1));

        // - Avec une période non contenue dans l'autre : Commence avant / se termine après.
        $period4 = new Period('2024-01-01 10:00:00', '2024-02-01 11:00:00');
        $this->assertTrue($period1->overlaps($period4));

        // - Avec une période non contenue dans l'autre : Se termine après.
        $period5 = new Period('2024-01-01 14:00:00', '2024-02-01 11:00:00');
        $this->assertTrue($period1->overlaps($period5));

        // - Avec une période non contenue dans l'autre : Commence avant.
        $period6 = new Period('2024-01-01 12:00:00', '2024-02-01 11:00:00');
        $this->assertTrue($period1->overlaps($period6));

        // - Avec une période non contenue dans l'autre : Pas en même temps.
        $period7 = new Period('2024-02-01 10:50:00', '2024-02-01 11:00:00');
        $this->assertFalse($period1->overlaps($period7));

        $period8 = new Period('2024-01-01 12:00:00', '2024-01-01 14:00:00');
        $this->assertFalse($period1->overlaps($period8));

        $period9 = new Period('2024-02-01 11:00:00', '2024-02-01 12:00:00');
        $this->assertFalse($period1->overlaps($period9));

        // - Avec des périodes infinies.
        $period10 = new Period('2024-01-01 12:00:00', null);
        $period11 = new Period('2024-02-01 13:00:00', null);
        $this->assertTrue($period10->overlaps($period11));
        $this->assertTrue($period11->overlaps($period10));
        $this->assertTrue($period10->overlaps($period5));
        $this->assertFalse($period11->overlaps($period7));
    }

    public function testSurroundingPeriods(): void
    {
        $doTest = function (Period $period1, Period $period2, array $expected) {
            $result = $period1->surroundingPeriods($period2);
            $this->assertIsArray($result);

            foreach (['pre', 'post'] as $part) {
                $this->assertArrayHasKey($part, $result);

                if ($expected[$part] === null) {
                    $this->assertNull($result[$part]);
                } else {
                    $this->assertInstanceOf(Period::class, $result[$part]);
                    $this->assertSameCanonicalize(
                        $expected[$part]->toArray(),
                        $result[$part]->toArray(),
                    );
                }
            }
        };

        // - Avec une période "plus grande" que l'autre: Avec une partie avant + après.
        $doTest(
            new Period('2024-01-01 14:00:00', '2024-02-01 11:00:00'),
            new Period('2024-01-01 16:10:59', '2024-02-01 10:50:00'),
            [
                'pre' => new Period('2024-01-01 14:00:00', '2024-01-01 16:10:59'),
                'post' => new Period('2024-02-01 10:50:00', '2024-02-01 11:00:00'),
            ],
        );

        // - Avec une période "plus petite" que l'autre :
        //   => Pas de périodes englobantes.
        $doTest(
            new Period('2024-01-01 16:10:59', '2024-02-01 10:50:00'),
            new Period('2024-01-01 14:00:00', '2024-02-01 11:00:00'),
            ['pre' => null, 'post' => null],
        );

        // - Avec des périodes identiques :
        //   => Pas de périodes englobantes.
        $doTest(
            new Period('2024-01-01 16:10:59', '2024-02-01 10:50:00'),
            new Period('2024-01-01 16:10:59', '2024-02-01 10:50:00'),
            ['pre' => null, 'post' => null],
        );

        // - Avec une période qui commence après mais qui se termine avant :
        //   => Période après uniquement.
        $doTest(
            new Period('2024-01-02 17:00:00', '2024-02-15 10:50:00'),
            new Period('2024-01-01 16:00:00', '2024-02-05 00:00:00'),
            [
                'pre' => null,
                'post' => new Period('2024-02-05 00:00:00', '2024-02-15 10:50:00'),
            ],
        );

        // - Avec une période qui commence avant mais qui se termine après :
        //   => Période avant uniquement.
        $doTest(
            new Period('2024-01-01 16:00:00', '2024-02-05 00:00:00'),
            new Period('2024-01-02 17:00:00', '2024-02-15 10:50:00'),
            [
                'pre' => new Period('2024-01-01 16:00:00', '2024-01-02 17:00:00'),
                'post' => null,
            ],
        );

        // - Avec deux périodes infinies.
        $doTest(
            new Period('2024-01-01 16:00:00', null),
            new Period('2024-01-02 17:00:00', null),
            [
                'pre' => new Period('2024-01-01 16:00:00', '2024-01-02 17:00:00'),
                'post' => null,
            ],
        );

        // - Avec une période qui commence en même-temps et une période englobée infinie.
        $doTest(
            new Period('2024-01-02 17:00:00', '2024-01-02 18:00:00'),
            new Period('2024-01-01 17:00:00', null),
            [
                'pre' => null,
                'post' => null,
            ],
        );

        // - Avec une période qui commence en même-temps et qui n'a pas de fin
        //   et une période englobée avec une date de fin spécifiée.
        $doTest(
            new Period('2024-01-02 17:00:00', null),
            new Period('2024-01-01 17:00:00', '2024-01-02 18:00:00'),
            [
                'pre' => null,
                'post' => new Period('2024-01-02 18:00:00', null),
            ],
        );
    }

    public function testToCalendarOccurrence(): void
    {
        // - Jour unique.
        $result = (new Period('2024-01-01', '2024-01-01', true))->toCalendarOccurrence();
        $this->assertInstanceOf(CalendarSingleDay::class, $result);

        /** @var CalendarSingleDay $result */
        $this->assertSame(
            '2024-01-01 00:00:00',
            $result->getDate()->getDateTime()
                ->format('Y-m-d H:i:s'),
        );

        // - Jours pleins.
        $result = (new Period('2024-01-01', '2024-01-02', true))->toCalendarOccurrence();
        $this->assertInstanceOf(CalendarMultiDay::class, $result);

        /** @var CalendarMultiDay $result */
        $this->assertSame(
            '2024-01-01 00:00:00',
            $result->getFirstDay()->getDateTime()
                ->format('Y-m-d H:i:s'),
        );
        $this->assertSame(
            '2024-01-02 00:00:00',
            $result->getLastDay()->getDateTime()
                ->format('Y-m-d H:i:s'),
        );

        // - Période dans une journée (non pleine).
        $result = (new Period('2024-01-01 13:30:25', '2024-01-01 16:12:10'))->toCalendarOccurrence();
        $this->assertInstanceOf(CalendarTimeSpan::class, $result);

        /** @var CalendarTimeSpan $result */
        $this->assertSame(
            '2024-01-01 13:30:25',
            $result->getBegin()->getDateTime()
                ->format('Y-m-d H:i:s'),
        );
        $this->assertSame(
            '2024-01-01 16:12:10',
            $result->getEnd()->getDateTime()
                ->format('Y-m-d H:i:s'),
        );

        // - Période sur plusieurs jours (non pleins).
        $result = (new Period('2024-01-01 00:00:00', '2024-01-06 10:00:00'))->toCalendarOccurrence();
        $this->assertInstanceOf(CalendarTimeSpan::class, $result);

        /** @var CalendarTimeSpan $result */
        $this->assertSame(
            '2024-01-01 00:00:00',
            $result->getBegin()->getDateTime()
                ->format('Y-m-d H:i:s'),
        );
        $this->assertSame(
            '2024-01-06 10:00:00',
            $result->getEnd()->getDateTime()
                ->format('Y-m-d H:i:s'),
        );
    }

    public function testIsSame(): void
    {
        $period1 = new Period('2024-01-01 14:42:21', '2024-12-01 10:02:20');
        $period2 = new Period('2024-01-01 14:42:21', '2024-12-01 10:02:20');
        $this->assertTrue($period1->isSame($period2));

        $period3 = new Period('2024-01-01 14:40:21', '2024-12-01 10:02:20');
        $this->assertFalse($period1->isSame($period3));
    }

    public function testIsInfinite(): void
    {
        $period1 = new Period('2024-01-01 14:40:21', '2024-12-01 10:02:20');
        $this->assertFalse($period1->isInfinite());

        $period2 = new Period('2024-01-01 14:40:21', null);
        $this->assertTrue($period2->isInfinite());

        $period3 = new Period('2024-01-01', null, true);
        $this->assertTrue($period3->isInfinite());
    }

    public function testIsPast(): void
    {
        static::setNow(Carbon::create(2025, 05, 23, 17, 05, 47));

        $period1 = new Period('2024-01-01 14:40:21', '2025-05-24 10:02:20');
        $this->assertFalse($period1->isPast());

        $period2 = new Period('2025-05-24 10:02:20', '2025-05-24 11:02:20');
        $this->assertFalse($period2->isPast());

        $period3 = new Period('2024-01-01 14:40:21', '2025-05-23 17:05:47');
        $this->assertTrue($period3->isPast());

        $period4 = new Period('2024-01-01 14:40:21', '2025-05-23 17:05:50');
        $this->assertFalse($period4->isPast());

        $period5 = new Period('2024-01-01 14:40:21', null);
        $this->assertFalse($period5->isPast());
    }

    public function testIsPastOrOngoing(): void
    {
        static::setNow(Carbon::create(2025, 05, 23, 17, 05, 47));

        $period1 = new Period('2024-01-01 14:40:21', '2025-05-24 10:02:20');
        $this->assertTrue($period1->isPastOrOngoing());

        $period2 = new Period('2025-05-24 10:02:20', '2025-05-24 11:02:20');
        $this->assertFalse($period2->isPastOrOngoing());

        $period3 = new Period('2024-01-01 14:40:21', '2025-05-23 17:05:47');
        $this->assertTrue($period3->isPastOrOngoing());

        $period4 = new Period('2024-01-01 14:40:21', '2025-05-23 17:05:20');
        $this->assertTrue($period4->isPastOrOngoing());

        $period5 = new Period('2024-01-01 14:40:21', null);
        $this->assertTrue($period5->isPastOrOngoing());

        $period6 = new Period('2025-05-23 17:05:50', null);
        $this->assertFalse($period6->isPastOrOngoing());
    }

    public function testToArray(): void
    {
        // - Test simple.
        $expected1 = [
            'start' => '2024-01-01 14:42:21',
            'end' => '2024-12-01 10:02:20',
            'isFullDays' => false,
        ];
        $period1 = new Period('2024-01-01 14:42:21', '2024-12-01 10:02:20');
        $this->assertSameCanonicalize($expected1, $period1->toArray());

        // - Période sans heures.
        $expected2 = [
            'start' => '2024-01-01 00:00:00',
            'end' => '2024-01-02 00:00:00',
            'isFullDays' => false,
        ];
        $period2 = new Period('2024-01-01', '2024-01-02');
        $this->assertSameCanonicalize($expected2, $period2->toArray());

        // - Période "pleine" simples.
        $expected3 = [
            'start' => '2024-01-01',
            'end' => '2024-01-02',
            'isFullDays' => true,
        ];
        $period3 = new Period('2024-01-01', '2024-01-02', true);
        $this->assertSameCanonicalize($expected3, $period3->toArray());

        // - Période "pleine" avec heures spécifiée.
        $expected4 = [
            'start' => '2024-01-01',
            'end' => '2024-01-02',
            'isFullDays' => true,
        ];
        $period4 = new Period('2024-01-01 14:12:10', '2024-01-02 12:45:00', true);
        $this->assertSameCanonicalize($expected4, $period4->toArray());

        // - Période infinie.
        $expected5 = [
            'start' => '2024-01-01 00:00:00',
            'end' => null,
            'isFullDays' => false,
        ];
        $period5 = new Period('2024-01-01 00:00:00', null);
        $this->assertSameCanonicalize($expected5, $period5->toArray());
    }

    public function testFromArray(): void
    {
        // - Format de données invalide.
        $invalidData = [
            [],
            ['[Invalid]'],
            ['[Invalid]', '[Invalid]'],
            ['2019-01-01', '[Invalid]'],
            ['[Invalid]', '2019-01-01'],
            ['2019-02-01', '2019-01-01'],
            [new \DateTime('2019-02-01'), new \DateTime('2019-01-01')],
            ['start' => '2019-01-01', 'end' => '[Invalid]'],
            ['start' => '[Invalid]', 'end' => '2019-01-01'],
            ['start' => '[Invalid]', 'end' => '[Invalid]'],
        ];
        foreach ($invalidData as $invalidDatum) {
            $this->assertThrow(\InvalidArgumentException::class, static fn () => (
                Period::fromArray($invalidDatum)
            ));
        }

        $doTest = function (array $data, array $expected) {
            $result = Period::fromArray($data);
            $this->assertInstanceOf(Period::class, $result);
            $this->assertSame($expected[0], $result->getStartDate()->format('Y-m-d H:i:s'));
            $this->assertSame($expected[1], $result->getEndDate()?->format('Y-m-d H:i:s'));
            $this->assertSame($expected[2], $result->isFullDays());
        };

        $doTest(
            ['start' => '2019-01-01', 'end' => '2019-02-01', 'isFullDays' => false],
            ['2019-01-01 00:00:00', '2019-02-01 00:00:00', false],
        );

        // - Format complexe: Journée entière.
        $doTest(
            ['start' => '2019-01-01', 'end' => '2019-02-01', 'isFullDays' => true],
            ['2019-01-01 00:00:00', '2019-02-02 00:00:00', true],
        );

        // - Format avec heures.
        $doTest(
            ['2019-01-01 10:28:14', '2019-01-01 11:42:32'],
            ['2019-01-01 10:28:14', '2019-01-01 11:42:32', false],
        );

        $doTest(
            [
                'start' => '2019-01-01 10:28:14',
                'end' => '2019-01-01 11:42:32',
                'isFullDays' => false,
            ],
            ['2019-01-01 10:28:14', '2019-01-01 11:42:32', false],
        );

        // - Format simple avec journées entières déduite.
        $doTest(
            ['2019-01-01', '2019-01-01'],
            ['2019-01-01 00:00:00', '2019-01-02 00:00:00', true],
        );

        // - Format complexe avec journées entières déduite.
        $doTest(
            ['start' => '2019-01-01', 'end' => '2019-02-01'],
            ['2019-01-01 00:00:00', '2019-02-02 00:00:00', true],
        );

        // - Format avec heures: Journée entière (1).
        $doTest(
            [
                'start' => '2019-01-01 10:28:14',
                'end' => '2019-01-01 11:42:32',
                'isFullDays' => true,
            ],
            ['2019-01-01 00:00:00', '2019-01-02 00:00:00', true],
        );

        // - Mélange des deux formats
        $doTest(
            ['2019-01-01 10:28:14', '2019-01-02'],
            ['2019-01-01 10:28:14', '2019-01-02 00:00:00', false],
        );
        $doTest(
            ['2019-01-01', '2019-01-01 11:42:32'],
            ['2019-01-01 00:00:00', '2019-01-01 11:42:32', false],
        );

        // - Avec DateTime.
        $doTest(
            ['start' => new \DateTime('2019-01-01 00:00:00'), 'end' => '2019-02-01 23:59:59'],
            ['2019-01-01 00:00:00', '2019-02-01 23:59:59', false],
        );

        // - Avec DateTime: Journée entière.
        $doTest(
            [
                'start' => new \DateTime('2019-01-01 00:00:00'),
                'end' => '2019-02-01 23:59:59',
                'isFullDays' => true,
            ],
            ['2019-01-01 00:00:00', '2019-02-02 00:00:00', true],
        );

        // - Avec Carbon.
        $doTest(
            [new Carbon('2019-01-01 00:00:00'), new Carbon('2019-02-01 23:59:59')],
            ['2019-01-01 00:00:00', '2019-02-01 23:59:59', false],
        );

        // - Avec Carbon: Journée entière.
        $doTest(
            [
                'start' => new Carbon('2019-01-01 00:00:00'),
                'end' => new Carbon('2019-02-01 23:59:59'),
                'isFullDays' => true,
            ],
            ['2019-01-01 00:00:00', '2019-02-02 00:00:00', true],
        );

        // - Avec période infinie.
        $doTest(
            [
                'start' => '2019-01-01 10:28:14',
                'end' => null,
                'isFullDays' => false,
            ],
            ['2019-01-01 10:28:14', null, false],
        );


        // - Avec période infinie + format simple.
        $doTest(
            ['2019-01-01', null],
            ['2019-01-01 00:00:00', null, true],
        );
    }

    public function testTryFrom(): void
    {
        // - Avec des valeurs invalides.
        foreach ([null, '', [], ['[Invalid]', '[Invalid]']] as $invalidValue) {
            $this->assertNull(Period::tryFrom($invalidValue));
        }

        $doTest = function (mixed $data, array $expected) {
            $result = Period::tryFrom($data);
            $this->assertInstanceOf(Period::class, $result);
            $this->assertSame($expected[0], $result->getStartDate()->format('Y-m-d H:i:s'));
            $this->assertSame($expected[1], $result->getEndDate()->format('Y-m-d H:i:s'));
            $this->assertSame($expected[2], $result->isFullDays());
        };

        // - Avec une période.
        $doTest(
            new Period('2024-01-01 14:42:21', '2024-12-01 10:02:20'),
            ['2024-01-01 14:42:21', '2024-12-01 10:02:20', false],
        );

        // - Avec une période en journées entières.
        $doTest(
            new Period('2024-01-01', '2024-12-02', true),
            ['2024-01-01 00:00:00', '2024-12-03 00:00:00', true],
        );

        // - Avec une classe implémentant `PeriodInterface`.
        $doTest(
            Event::findOrFail(1),
            ['2018-12-16 15:45:00', '2018-12-19 00:00:00', false],
        );

        // - Avec un tableau.
        $doTest(
            ['2019-01-01', '2019-01-01 23:59:59'],
            ['2019-01-01 00:00:00', '2019-01-01 23:59:59', false],
        );
    }

    public function testFrom(): void
    {
        // - Avec des valeurs invalides.
        foreach ([null, '', [], ['[Invalid]', '[Invalid]']] as $invalidValue) {
            $this->assertThrow(\InvalidArgumentException::class, static fn () => (
                Period::from($invalidValue)
            ));
        }

        $doTest = function (mixed $data, array $expected) {
            $result = Period::from($data);
            $this->assertInstanceOf(Period::class, $result);
            $this->assertSame($expected[0], $result->getStartDate()->format('Y-m-d H:i:s'));
            $this->assertSame($expected[1], $result->getEndDate()->format('Y-m-d H:i:s'));
            $this->assertSame($expected[2], $result->isFullDays());
        };

        // - Avec une période.
        $doTest(
            new Period('2024-01-01 14:42:21', '2024-12-01 10:02:20'),
            ['2024-01-01 14:42:21', '2024-12-01 10:02:20', false],
        );

        // - Avec une période en journées entières.
        $doTest(
            new Period('2024-01-01', '2024-12-02', true),
            ['2024-01-01 00:00:00', '2024-12-03 00:00:00', true],
        );

        // - Avec une classe implémentant `PeriodInterface`.
        $doTest(
            Event::findOrFail(1),
            ['2018-12-16 15:45:00', '2018-12-19 00:00:00', false],
        );

        // - Avec un tableau.
        $doTest(
            ['2019-01-01', '2019-01-01 23:59:59'],
            ['2019-01-01 00:00:00', '2019-01-01 23:59:59', false],
        );
    }
}
