<?php
declare(strict_types=1);

namespace Loxya\Tests;

use Fig\Http\Message\StatusCodeInterface as StatusCode;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Loxya\Models\Technician;
use Loxya\Support\Arr;
use Loxya\Support\File\UploadedFile;

final class TechniciansTest extends ApiTestCase
{
    public static function data(?int $id = null, string $format = Technician::SERIALIZE_DEFAULT)
    {
        $technicians = new Collection([
            [
                'id' => 1,
                'user_id' => 2,
                'first_name' => 'Roger',
                'last_name' => 'Rabbit',
                'full_name' => 'Roger Rabbit',
                'nickname' => 'Riri',
                'email' => 'tester2@loxya.com',
                'phone' => null,
                'street' => null,
                'postal_code' => null,
                'locality' => null,
                'country_id' => null,
                'full_address' => null,
                'country' => null,
                'user' => UsersTest::data(2),
                'roles' => [
                    RolesTest::data(3),
                    RolesTest::data(1),
                ],
                'note' => null,
            ],
            [
                'id' => 2,
                'user_id' => null,
                'first_name' => 'Jean',
                'last_name' => 'Technicien',
                'full_name' => 'Jean Technicien',
                'nickname' => null,
                'email' => 'client@technicien.com',
                'phone' => '+33645698520',
                'street' => null,
                'postal_code' => null,
                'locality' => null,
                'country_id' => 2,
                'full_address' => null,
                'country' => CountriesTest::data(2),
                'user' => null,
                'roles' => [
                    RolesTest::data(2),
                ],
                'note' => null,
            ],
        ]);

        $technicians = match ($format) {
            Technician::SERIALIZE_DEFAULT => $technicians->map(static fn ($material) => (
                Arr::except($material, ['user'])
            )),
            Technician::SERIALIZE_DETAILS => $technicians,
            default => throw new \InvalidArgumentException(sprintf("Unknown format \"%s\"", $format)),
        };

        return static::dataFactory($id, $technicians->all());
    }

    public function testGetAll(): void
    {
        $this->client->get('/api/technicians');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponsePaginatedData(2, [
            self::data(1),
            self::data(2),
        ]);
    }

    public function testGetAllWithSearch(): void
    {
        // - Prénom
        $this->client->get('/api/technicians?search=ro');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponsePaginatedData(1, [
            self::data(1), // - Roger Rabbit
        ]);

        // - Prénom nom
        $this->client->get('/api/technicians?search=jean tec');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponsePaginatedData(1, [
            self::data(2), // - Jean Technicien
        ]);

        // - Nom Prénom
        $this->client->get('/api/technicians?search=technicien jean');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponsePaginatedData(1, [
            self::data(2), // - Jean Technicien
        ]);

        // - Email
        $this->client->get('/api/technicians?search=client@technicien.com');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponsePaginatedData(1, [
            self::data(2), // - Jean Technicien (client@technicien.com)
        ]);

        // - Nickname
        $this->client->get('/api/technicians?search=rir');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponsePaginatedData(1, [
            self::data(1), // - Roger Rabbit (Riri)
        ]);

        // - Rôle
        $this->client->get('/api/technicians?role=1');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponsePaginatedData(1, [
            self::data(1), // - Roger Rabbit (Riri)
        ]);
    }

    public function testGetAllWithAvailabilityPeriod(): void
    {
        // - Aucun technicien n'est disponible pendant ces dates
        $this->client->get('/api/technicians?availabilityPeriod[start]=2018-12-15&availabilityPeriod[end]=2018-12-20');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponsePaginatedData(0);

        // - Un technicien est disponible pendant ces dates
        $this->client->get('/api/technicians?availabilityPeriod[start]=2018-12-17&availabilityPeriod[end]=2018-12-17');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponsePaginatedData(1, [
            self::data(2),
        ]);
    }

    public function testGetAllWhileEvent(): void
    {
        $this->client->get('/api/technicians/while-event/2');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseData([
            array_merge(self::data(1), [
                'events' => [
                    [
                        'id' => 1,
                        'event_id' => 1,
                        'event' => EventsTest::data(1),
                        'technician_id' => 1,
                        'period' => [
                            'start' => '2018-12-17 09:00:00',
                            'end' => '2018-12-18 22:00:00',
                            'isFullDays' => false,
                        ],
                        'role' => RolesTest::data(1),
                    ],
                ],
            ]),
            array_merge(self::data(2), [
                'events' => [
                    [
                        'id' => 2,
                        'event_id' => 1,
                        'event' => EventsTest::data(1),
                        'technician_id' => 2,
                        'period' => [
                            'start' => '2018-12-18 14:00:00',
                            'end' => '2018-12-18 18:00:00',
                            'isFullDays' => false,
                        ],
                        'role' => RolesTest::data(2),
                    ],
                ],
            ]),
        ]);

        $this->client->get('/api/technicians/while-event/1');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseData([
            array_merge(self::data(1), ['events' => []]),
            array_merge(self::data(2), ['events' => []]),
        ]);

        // - En spécifiant un rôle
        $this->client->get('/api/technicians/while-event/1?role=3');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseData([
            array_merge(self::data(1), ['events' => []]),
        ]);
    }

    public function testGetAllWithAssignments(): void
    {
        static::setCustomConfig(['maxItemsPerPage' => 1]);

        // - Sans période spécifiée => Erreur.
        $this->client->get('/api/technicians/with-assignments');
        $this->assertStatusCode(StatusCode::STATUS_NOT_ACCEPTABLE);

        // - Test sans pagination, avec un trop grand intervalle.
        $this->client->get('/api/technicians/with-assignments?period[start]=2018-01-01&period[end]=2018-12-31');
        $this->assertStatusCode(StatusCode::STATUS_RANGE_NOT_SATISFIABLE);

        // - Test simple avec pagination (page 1).
        $this->client->get('/api/technicians/with-assignments?period[start]=2018-12-01&period[end]=2018-12-31');
        $this->assertResponsePaginatedData(2, [
            array_merge(self::data(1), [
                'events' => [
                    [
                        'id' => 1,
                        'event_id' => 1,
                        'event' => EventsTest::data(1),
                        'technician_id' => 1,
                        'period' => [
                            'start' => '2018-12-17 09:00:00',
                            'end' => '2018-12-18 22:00:00',
                            'isFullDays' => false,
                        ],
                        'role' => RolesTest::data(1),
                    ],
                ],
            ]),
        ]);

        // - Test simple sans pagination.
        $this->client->get('/api/technicians/with-assignments?paginated=0&period[start]=2018-12-01&period[end]=2018-12-31');
        $this->assertResponseData([
            array_merge(self::data(1), [
                'events' => [
                    [
                        'id' => 1,
                        'event_id' => 1,
                        'event' => EventsTest::data(1),
                        'technician_id' => 1,
                        'period' => [
                            'start' => '2018-12-17 09:00:00',
                            'end' => '2018-12-18 22:00:00',
                            'isFullDays' => false,
                        ],
                        'role' => RolesTest::data(1),
                    ],
                ],
            ]),
            array_merge(self::data(2), [
                'events' => [
                    [
                        'id' => 2,
                        'event_id' => 1,
                        'event' => EventsTest::data(1),
                        'technician_id' => 2,
                        'period' => [
                            'start' => '2018-12-18 14:00:00',
                            'end' => '2018-12-18 18:00:00',
                            'isFullDays' => false,
                        ],
                        'role' => RolesTest::data(2),
                    ],
                ],
            ]),
        ]);
    }

    public function testGetEventNotFound(): void
    {
        $this->client->get('/api/technicians/999/events');
        $this->assertStatusCode(StatusCode::STATUS_NOT_FOUND);
    }

    public function testGetEvents(): void
    {
        $this->client->get('/api/technicians/1/events');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseData([
            [
                'id' => 1,
                'event_id' => 1,
                'technician_id' => 1,
                'period' => [
                    'start' => '2018-12-17 09:00:00',
                    'end' => '2018-12-18 22:00:00',
                    'isFullDays' => false,
                ],
                'role' => RolesTest::data(1),
                'event' => EventsTest::data(1),
            ],
        ]);

        $this->client->get('/api/technicians/2/events');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseData([
            [
                'id' => 2,
                'event_id' => 1,
                'technician_id' => 2,
                'period' => [
                    'start' => '2018-12-18 14:00:00',
                    'end' => '2018-12-18 18:00:00',
                    'isFullDays' => false,
                ],
                'role' => RolesTest::data(2),
                'event' => EventsTest::data(1),
            ],
            [
                'id' => 3,
                'event_id' => 7,
                'technician_id' => 2,
                'period' => [
                    'start' => '2023-05-25 00:00:00',
                    'end' => '2023-05-29 00:00:00',
                    'isFullDays' => false,
                ],
                'role' => RolesTest::data(3),
                'event' => EventsTest::data(7),
            ],
        ]);
    }

    public function testGetOneNotFound(): void
    {
        $this->client->get('/api/technicians/999');
        $this->assertStatusCode(StatusCode::STATUS_NOT_FOUND);
    }

    public function testGetOne(): void
    {
        $this->client->get('/api/technicians/1');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseData(self::data(1, Technician::SERIALIZE_DETAILS));
    }

    public function testCreateWithoutData(): void
    {
        $this->client->post('/api/technicians');
        $this->assertStatusCode(StatusCode::STATUS_BAD_REQUEST);
        $this->assertApiErrorMessage("No data was provided.");
    }

    public function testCreateBadData(): void
    {
        // - Test 1.
        $this->client->post('/api/technicians', [
            'foo' => 'bar',
            'first_name' => 'Jean-j@cques',
            'email' => 'invalid',
            'nickname' => 'ilestvraimeeeentrèslongcesurnom',
        ]);
        $this->assertApiValidationError([
            'nickname' => "Max. 30 characters.",
            'first_name' => "This field contains some unauthorized characters.",
            'last_name' => "This field is mandatory.",
            'email' => "This email address is invalid.",
        ]);

        // - Test 2.
        $this->client->put('/api/technicians/2', [
            'first_name' => 'Tester',
            'last_name' => 'Tagger',
            'nickname' => 'TagZz',
            'email' => 'tester2@loxya.com',
            'phone' => 'notAphoneNumber',
        ]);
        $this->assertApiValidationError([
            'phone' => "This phone number is invalid.",
        ]);
    }

    public function testCreate(): void
    {
        $this->client->post('/api/technicians', [
            'first_name' => 'José',
            'last_name' => 'Gatillon',
            'nickname' => 'Gégé',
            'email' => 'test@other-tech.net',
            'phone' => null,
            'street' => null,
            'postal_code' => '74000',
            'locality' => 'Annecy',
            'country_id' => 2,
            'roles' => [1],
            'note' => null,
        ]);

        $this->assertStatusCode(StatusCode::STATUS_CREATED);
        $this->assertResponseData([
            'id' => 3,
            'user_id' => null,
            'first_name' => 'José',
            'last_name' => 'Gatillon',
            'nickname' => 'Gégé',
            'email' => 'test@other-tech.net',
            'full_name' => 'José Gatillon',
            'phone' => null,
            'street' => null,
            'postal_code' => '74000',
            'locality' => 'Annecy',
            'country_id' => 2,
            'country' => CountriesTest::data(2),
            'full_address' => '74000 Annecy',
            'user' => null,
            'roles' => [
                RolesTest::data(1),
            ],
            'note' => null,
        ]);
    }

    public function testUpdate(): void
    {
        $this->client->put('/api/technicians/1', [
            'first_name' => 'José',
            'last_name' => 'Gatillon',
            'nickname' => 'Gégé',
            'postal_code' => '74000',
            'locality' => 'Annecy',
            'country_id' => 2,
            'roles' => [1, 2],
        ]);

        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseData(array_replace_recursive(
            static::data(1, Technician::SERIALIZE_DETAILS),
            [
                'first_name' => 'José',
                'last_name' => 'Gatillon',
                'nickname' => 'Gégé',
                'full_name' => 'José Gatillon',
                'postal_code' => '74000',
                'locality' => 'Annecy',
                'country_id' => 2,
                'country' => CountriesTest::data(2),
                'full_address' => '74000 Annecy',
                'user' => [
                    'first_name' => 'José',
                    'last_name' => 'Gatillon',
                    'full_name' => 'José Gatillon',
                ],
                'roles' => [
                    RolesTest::data(1),
                    RolesTest::data(2),
                ],
            ],
        ));
    }

    public function testDeleteAndDestroy(): void
    {
        // - First call: soft delete.
        $this->client->delete('/api/technicians/2');
        $this->assertStatusCode(StatusCode::STATUS_NO_CONTENT);
        $softDeleted = Technician::withTrashed()->find(2);
        $this->assertNotNull($softDeleted);
        $this->assertNotEmpty($softDeleted->deleted_at);

        // - Second call: actually DESTROY record from DB
        $this->client->delete('/api/technicians/2');
        $this->assertStatusCode(StatusCode::STATUS_NO_CONTENT);
        $this->assertNull(Technician::withTrashed()->find(2));
    }

    public function testRestoreNotFound(): void
    {
        $this->client->put('/api/technicians/restore/999');
        $this->assertStatusCode(StatusCode::STATUS_NOT_FOUND);
    }

    public function testRestore(): void
    {
        // - First, delete person #2
        $this->client->delete('/api/technicians/2');
        $this->assertStatusCode(StatusCode::STATUS_NO_CONTENT);

        // - Then, restore person #2
        $this->client->put('/api/technicians/restore/2');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertNotNull(Technician::find(2));
    }

    public function testAttachDocument(): void
    {
        static::setNow(Carbon::create(2022, 10, 22, 18, 42, 36));

        $createUploadedFile = static function (string $from) {
            $tmpFile = tmpfile();
            fwrite($tmpFile, file_get_contents($from));
            return $tmpFile;
        };

        // - Événement inexistant.
        $this->client->post('/api/technicians/999/documents');
        $this->assertStatusCode(StatusCode::STATUS_NOT_FOUND);

        // - Test sans fichiers (payload vide)
        $this->client->post('/api/technicians/2/documents', null, []);
        $this->assertStatusCode(StatusCode::STATUS_BAD_REQUEST);
        $this->assertApiErrorMessage("Invalid number of files sent: a single file is expected.");

        // - Test avec des fichiers sans problèmes.
        $validUploads = [
            [
                'id' => 1,
                'file' => new UploadedFile(
                    $createUploadedFile(TESTS_FILES_FOLDER . DS . 'file.pdf'),
                    13_269,
                    UPLOAD_ERR_OK,
                    "Intervention 8/05/2022.pdf",
                    'application/pdf',
                ),
                'expected' => [
                    'id' => 7,
                    'name' => "Intervention 8/05/2022.pdf",
                    'type' => 'application/pdf',
                    'size' => 13_269,
                    'url' => 'http://loxya.test/documents/7',
                    'created_at' => '2022-10-22 18:42:36',
                ],
            ],
            [
                'id' => 2,
                'file' => new UploadedFile(
                    $createUploadedFile(TESTS_FILES_FOLDER . DS . 'file.pdf'),
                    13_269,
                    UPLOAD_ERR_OK,
                    'Contrat saison hiver 2022.pdf',
                    'application/pdf',
                ),
                'expected' => [
                    'id' => 8,
                    'name' => 'Contrat saison hiver 2022.pdf',
                    'type' => 'application/pdf',
                    'size' => 13_269,
                    'url' => 'http://loxya.test/documents/8',
                    'created_at' => '2022-10-22 18:42:36',
                ],
            ],
            [
                'id' => 2,
                'file' => new UploadedFile(
                    $createUploadedFile(TESTS_FILES_FOLDER . DS . 'file.csv'),
                    54,
                    UPLOAD_ERR_OK,
                    'planning.csv',
                    'text/csv',
                ),
                'expected' => [
                    'id' => 9,
                    'name' => 'planning.csv',
                    'type' => 'text/csv',
                    'size' => 54,
                    'url' => 'http://loxya.test/documents/9',
                    'created_at' => '2022-10-22 18:42:36',
                ],
            ],
        ];
        foreach ($validUploads as $validUpload) {
            $url = sprintf('/api/technicians/%d/documents', $validUpload['id']);
            $this->client->post($url, null, $validUpload['file']);
            $this->assertStatusCode(StatusCode::STATUS_CREATED);
            $this->assertResponseData($validUpload['expected']);
        }
        $this->assertSame([7], Technician::findOrFail(1)->documents->pluck('id')->all());
        $this->assertSame([8, 6, 9], Technician::findOrFail(2)->documents->pluck('id')->all());

        // - Test avec des fichiers avec erreurs.
        $invalidUploads = [
            [
                'file' => new UploadedFile(
                    $createUploadedFile(TESTS_FILES_FOLDER . DS . 'file.pdf'),
                    262_144_000,
                    UPLOAD_ERR_OK,
                    'Un fichier bien trop volumineux.pdf',
                    'application/pdf',
                ),
                'expected' => "This file exceeds maximum size allowed.",
            ],
            [
                'file' => new UploadedFile(
                    $createUploadedFile(TESTS_FILES_FOLDER . DS . 'file.csv'),
                    54,
                    UPLOAD_ERR_CANT_WRITE,
                    'échec-upload.csv',
                    'text/csv',
                ),
                'expected' => "File upload failed.",
            ],
            [
                'file' => new UploadedFile(
                    tmpfile(),
                    121_540,
                    UPLOAD_ERR_OK,
                    'app.dmg',
                    'application/octet-stream',
                ),
                'expected' => "This file type is not allowed.",
            ],
        ];
        foreach ($invalidUploads as $invalidUpload) {
            $this->client->post('/api/technicians/2/documents', null, $invalidUpload['file']);
            $this->assertApiValidationError(['file' => $invalidUpload['expected']]);
        }
    }

    public function testGetDocuments(): void
    {
        // - Technicien inexistant.
        $this->client->get('/api/technicians/999/documents');
        $this->assertStatusCode(StatusCode::STATUS_NOT_FOUND);

        // - Documents du technicien #2.
        $this->client->get('/api/technicians/2/documents');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseData([
            DocumentsTest::data(6),
        ]);

        // - Documents du technicien #1.
        $this->client->get('/api/technicians/1/documents');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertResponseData([]);
    }
}
