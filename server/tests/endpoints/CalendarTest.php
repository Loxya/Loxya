<?php
declare(strict_types=1);

namespace Loxya\Tests;

use Fig\Http\Message\StatusCodeInterface as StatusCode;
use Illuminate\Support\Carbon;
use Loxya\Models\Enums\PublicCalendarPeriodDisplay;
use Loxya\Models\Setting;

final class CalendarTest extends ApiTestCase
{
    public function testPublic(): void
    {
        static::setNow(Carbon::create(2019, 02, 01, 12, 00, 00));

        //
        // - Doit renvoyer une 404 si l'UUID n'est pas le bon.
        //

        $this->client->get('/calendar/public/-unknown-.ics');
        $this->assertStatusCode(StatusCode::STATUS_NOT_FOUND);

        //
        // - Doit renvoyer le calendrier.
        //

        // - Avec présentation par périodes d'opération.
        $responseStream = $this->client->get('/calendar/public/dfe7cd82-52b9-4c9b-aaed-033df210f23b.ics');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertTrue($responseStream->isReadable());
        $this->assertMatchesTextSnapshot((string) $responseStream);

        // - Avec présentation par périodes de mobilisation.
        Setting::findOrFail('calendar.public.displayedPeriod')->update([
            'value' => PublicCalendarPeriodDisplay::MOBILIZATION->value,
        ]);
        $responseStream = $this->client->get('/calendar/public/dfe7cd82-52b9-4c9b-aaed-033df210f23b.ics');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertTrue($responseStream->isReadable());
        $this->assertMatchesTextSnapshot((string) $responseStream);

        // - Avec présentation par périodes de mobilisation ET opérations.
        Setting::findOrFail('calendar.public.displayedPeriod')->update([
            'value' => PublicCalendarPeriodDisplay::BOTH->value,
        ]);
        $responseStream = $this->client->get('/calendar/public/dfe7cd82-52b9-4c9b-aaed-033df210f23b.ics');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertTrue($responseStream->isReadable());
        $this->assertMatchesTextSnapshot((string) $responseStream);

        //
        // - Doit renvoyer une 404 si le calendrier public est désactivé.
        //

        Setting::findOrFail('calendar.public.enabled')->update(['value' => false]);

        $this->client->get('/calendar/public/dfe7cd82-52b9-4c9b-aaed-033df210f23b.ics');
        $this->assertStatusCode(StatusCode::STATUS_NOT_FOUND);
    }
}
