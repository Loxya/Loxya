<?php
declare(strict_types=1);

namespace Loxya\Controllers;

use Carbon\CarbonImmutable;
use DI\Container;
use Fig\Http\Message\StatusCodeInterface as StatusCode;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Loxya\Config\Config;
use Loxya\Http\Request as HttpRequest;
use Loxya\Models\Country;
use Loxya\Models\Document;
use Loxya\Models\Enums\Group;
use Loxya\Models\Event;
use Loxya\Models\Material;
use Loxya\Models\Park;
use Loxya\Services\Auth;
use Loxya\Services\I18n;
use Loxya\Support\Collections\MaterialsCollection;
use Loxya\Support\Database\QueryAggregator;
use Loxya\Support\Pdf\Pdf;
use Loxya\Support\Str;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\UploadedFileInterface;
use Slim\Exception\HttpBadRequestException;
use Slim\Exception\HttpForbiddenException;
use Slim\Exception\HttpNotFoundException;
use Slim\Http\Response;
use Slim\HttpCache\CacheProvider as HttpCacheProvider;

final class MaterialController extends BaseController
{
    private I18n $i18n;

    private HttpCacheProvider $httpCache;

    public function __construct(Container $container, I18n $i18n, HttpCacheProvider $httpCache)
    {
        parent::__construct($container);

        $this->i18n = $i18n;
        $this->httpCache = $httpCache;
    }

    // ------------------------------------------------------
    // -
    // -    Getters
    // -
    // ------------------------------------------------------

    public function getOne(HttpRequest $httpRequest, Response $response): ResponseInterface
    {
        $id = $httpRequest->getIntegerAttribute('id');
        $material = Material::findOrFail($id);

        $data = $this->_formatOne($material);
        return $response->withJson($data, StatusCode::STATUS_OK);
    }

    public function getAll(HttpRequest $httpRequest, Response $response): ResponseInterface
    {
        $search = $httpRequest->getSearchArrayQueryParam('search');
        $paginated = $httpRequest->getBooleanQueryParam('paginated', true);
        $limit = $httpRequest->getIntegerQueryParam('limit');
        $ascending = $httpRequest->getBooleanQueryParam('ascending', true);
        $quantitiesPeriod = $httpRequest->getPeriodQueryParam('quantitiesPeriod');
        $orderBy = $httpRequest->getOrderByQueryParam('orderBy', Material::class);
        $onlyDeleted = $httpRequest->getBooleanQueryParam('onlyDeleted', false);
        $withDeleted = $httpRequest->getQueryParam('withDeleted', false);

        // - Filtres
        $categoryId = $httpRequest->getQueryParam('category');
        $subCategoryId = $httpRequest->getIntegerQueryParam('subCategory');
        $parkId = $httpRequest->getIntegerQueryParam('park');
        $tags = $httpRequest->getIntegerArrayQueryParam('tags');

        $isComplexeOrderBy = (
            in_array($orderBy, ['stock_quantity', 'out_of_order_quantity'], true) &&
            ($parkId !== null)
        );

        $query = Material::query()
            ->prepareSerialize(Material::SERIALIZE_WITH_AVAILABILITY)
            ->when(!empty($search), static fn (Builder $subQuery) => (
                $subQuery->search($search)
            ))
            ->when($onlyDeleted, static fn (Builder $subQuery) => (
                $subQuery->onlyTrashed()
            ))
            ->when($withDeleted, static fn (Builder $subQuery) => (
                $subQuery->withTrashed()
            ))
            ->when(!$isComplexeOrderBy, static fn (Builder $subQuery) => (
                $subQuery->customOrderBy($orderBy, $ascending ? 'asc' : 'desc')
            ));

        //
        // - Filtres
        //

        $query = $query
            // - Catégorie.
            ->when($categoryId === 'uncategorized' || is_numeric($categoryId), static fn (Builder $builder) => (
                $builder->where('category_id', (
                    $categoryId !== 'uncategorized' ? (int) $categoryId : null
                ))
            ))
            // - Sous-catégorie.
            ->when($subCategoryId !== null, static fn (Builder $builder) => (
                $builder->where('sub_category_id', $subCategoryId)
            ))
            // - Parc.
            ->when($parkId !== null, static fn (Builder $builder) => (
                $builder->inPark($parkId)
            ))
            // - Tags.
            ->when(!empty($tags), static fn (Builder $builder) => (
                $builder->whereHas('tags', static function ($query) use ($tags) {
                    $query->whereIn('id', $tags);
                })
            ));

        //
        // - Tri complexe.
        //

        if ($isComplexeOrderBy) {
            if ($orderBy === 'stock_quantity') {
                $query
                    ->reorder(
                        'stock_quantity',
                        $ascending ? 'asc' : 'desc',
                    );
            }
            if ($orderBy === 'out_of_order_quantity') {
                $query
                    ->reorder(
                        'out_of_order_quantity',
                        $ascending ? 'asc' : 'desc',
                    );
            }
        }

        //
        // - Requête + Résultat
        //

        $results = $paginated
            ? $this->paginate($httpRequest, $query, $limit)
            : ['data' => $query->get()];

        $results['data'] = Material::allWithAvailabilities(
            $results['data'],
            $quantitiesPeriod,
        );
        $results['data'] = $results['data']->map(static fn (Material $material) => (
            $material->serialize(Material::SERIALIZE_WITH_AVAILABILITY)
        ));

        $results = $paginated ? $results : $results['data'];
        return $response->withJson($results, StatusCode::STATUS_OK);
    }

    public function getAllWhileEvent(HttpRequest $httpRequest, Response $response): ResponseInterface
    {
        $eventId = $httpRequest->getIntegerAttribute('eventId');

        $currentEvent = Event::findOrFail($eventId);
        $materials = Material::query()
            ->prepareSerialize(Material::SERIALIZE_WITH_CONTEXT)
            ->withTrashed()
            ->orderBy('reference')
            ->get();

        $materials = Material::allWithAvailabilities(
            $materials,
            $currentEvent,
        );
        $materials = $materials->map(static function (Material $material) use ($currentEvent) {
            $material->context = $currentEvent;
            return $material->serialize(Material::SERIALIZE_WITH_CONTEXT);
        });

        return $response->withJson($materials, StatusCode::STATUS_OK);
    }

    public function printAll(HttpRequest $httpRequest, Response $response): ResponseInterface
    {
        $onlyParkId = $httpRequest->getIntegerQueryParam('park');

        if (!Auth::is(Group::ADMINISTRATION)) {
            throw new HttpForbiddenException($httpRequest);
        }

        /** @var Collection<array-key, Park> $parks */
        $parks = Park::with('materials')->get();

        $parksMaterials = [];
        foreach ($parks as $park) {
            if ($onlyParkId !== null && $onlyParkId !== $park->id) {
                continue;
            }

            $parkMaterials = $park->materials
                ->values();

            if ($parkMaterials->isEmpty()) {
                continue;
            }

            $parksMaterials[] = [
                'id' => $park->id,
                'name' => $park->name,
                'materials' => (new MaterialsCollection($parkMaterials))->bySubCategories(),
            ];
        }

        $collator = new \Collator(container('i18n')->getLocale());
        usort($parksMaterials, static fn ($a, $b) => (
            $collator->compare($a['name'], $b['name'] ?? '')
        ));

        // - Nom du parc (si export pour un seul parc)
        $parkOnlyName = null;
        if ($onlyParkId !== null) {
            $parksName = $parks->pluck('name', 'id')->all();
            if (array_key_exists($onlyParkId, $parksName)) {
                $parkOnlyName = $parksName[$onlyParkId];
            }
        }

        // - Société.
        $company = Config::get('companyData');
        $company = array_replace($company, [
            'country' => ($company['country'] ?? null) !== null
                ? Country::tryFromCode($company['country'])
                : null,
        ]);

        $date = CarbonImmutable::now();
        $fileName = Str::slugify(implode('-', [
            $this->i18n->translate('materials-list'),
            $parkOnlyName ?: $company['name'],
            $date->format('Y-m-d'),
        ]));

        $pdf = Pdf::createFromTemplate('materials-list', $this->i18n, $fileName, [
            'date' => $date,
            'company' => $company,
            'parkOnlyName' => $parkOnlyName,
            'currency' => Config::get('currency'),
            'parksMaterialsList' => $parksMaterials,
        ]);

        return $pdf->asResponse($response);
    }

    public function getDocuments(HttpRequest $httpRequest, Response $response): ResponseInterface
    {
        $id = $httpRequest->getIntegerAttribute('id');
        $material = Material::findOrFail($id);

        return $response->withJson($material->documents, StatusCode::STATUS_OK);
    }

    public function getBookings(HttpRequest $httpRequest, Response $response): ResponseInterface
    {
        $id = $httpRequest->getIntegerAttribute('id');
        $limit = $httpRequest->getIntegerQueryParam('limit');
        $ascending = $httpRequest->getBooleanQueryParam('ascending', false);
        $period = $httpRequest->getPeriodQueryParam('period');

        $material = Material::findOrFail($id);

        $query = (new QueryAggregator())
            // - Événements.
            ->add(Event::class, (
                $material->events()
                    ->when($period !== null, static fn (Builder $subQuery) => (
                        $subQuery->inPeriod($period, withOverdue: true)
                    ))
                    ->with(['beneficiaries', 'technicians', 'materials'])
            ))
            ->orderBy('mobilization_start_date', $ascending ? 'asc' : 'desc');

        $results = $this->paginate($httpRequest, $query, $limit ?? 50);

        // - Le prefetching a été supprimé car ça ajoutait une trop grosse
        //   utilisation de la mémoire, et ralentissait beaucoup la requête.

        $useMultipleParks = Park::count() > 1;

        $results['data'] = $results['data']->map(static fn ($booking) => array_merge(
            $booking->serialize($booking::SERIALIZE_BOOKING_SUMMARY),
            [
                'pivot' => [
                    'quantity' => $booking->pivot->quantity,
                ],
                'parks' => $useMultipleParks
                    ? array_values($booking->parks)
                    : [],
            ],
        ));

        return $response->withJson($results, StatusCode::STATUS_OK);
    }

    public function getPicture(HttpRequest $httpRequest, Response $response): ResponseInterface
    {
        $id = $httpRequest->getIntegerAttribute('id');
        $material = Material::findOrFail($id);

        $picturePath = $material->picture_real_path;
        if (!$picturePath) {
            throw new HttpNotFoundException($httpRequest, "There is no image for this material.");
        }

        // - Le fichier source est introuvable ...
        if (!file_exists($picturePath)) {
            throw new HttpNotFoundException($httpRequest);
        }

        /** @var Response $response */
        $response = $this->httpCache->denyCache($response);
        return $response
            ->withStatus(StatusCode::STATUS_OK)
            ->withFile($picturePath);
    }

    // ------------------------------------------------------
    // -
    // -    Setters
    // -
    // ------------------------------------------------------

    public function create(HttpRequest $httpRequest, Response $response): ResponseInterface
    {
        $postData = (array) $httpRequest->getParsedBody();
        if (empty($postData)) {
            throw new HttpBadRequestException($httpRequest, "No data was provided.");
        }

        $material = Material::new($postData);

        $data = $this->_formatOne($material);
        return $response->withJson($data, StatusCode::STATUS_CREATED);
    }

    public function update(HttpRequest $httpRequest, Response $response): ResponseInterface
    {
        $id = $httpRequest->getIntegerAttribute('id');
        $material = Material::findOrFail($id);

        $postData = (array) $httpRequest->getParsedBody();
        if (empty($postData)) {
            throw new HttpBadRequestException($httpRequest, "No data was provided.");
        }

        $material->edit($postData);

        $data = $this->_formatOne($material);
        return $response->withJson($data, StatusCode::STATUS_OK);
    }

    public function attachDocument(HttpRequest $httpRequest, Response $response): ResponseInterface
    {
        $id = $httpRequest->getIntegerAttribute('id');
        $material = Material::findOrFail($id);

        /** @var UploadedFileInterface[] $uploadedFiles */
        $uploadedFiles = $httpRequest->getUploadedFiles();
        if (count($uploadedFiles) !== 1) {
            throw new HttpBadRequestException($httpRequest, "Invalid number of files sent: a single file is expected.");
        }

        $file = array_values($uploadedFiles)[0];
        $document = new Document(compact('file'));
        $document->author()->associate(Auth::user());
        $material->documents()->save($document);

        return $response->withJson($document, StatusCode::STATUS_CREATED);
    }

    public function delete(HttpRequest $httpRequest, Response $response): ResponseInterface
    {
        $id = $httpRequest->getIntegerAttribute('id');

        /** @var Material $material */
        $material = Material::withTrashed()->findOrFail($id);

        $isDeleted = $material->trashed()
            ? $material->forceDelete()
            : $material->delete();

        if (!$isDeleted) {
            throw new \RuntimeException("An unknown error occurred while deleting the material.");
        }

        return $response->withStatus(StatusCode::STATUS_NO_CONTENT);
    }

    public function restore(HttpRequest $httpRequest, Response $response): ResponseInterface
    {
        $id = $httpRequest->getIntegerAttribute('id');

        /** @var Material $material */
        $material = Material::onlyTrashed()->findOrFail($id);

        if (!$material->restore()) {
            throw new \RuntimeException(sprintf("Unable to restore the record %d.", $id));
        }

        $data = $this->_formatOne($material);
        return $response->withJson($data, StatusCode::STATUS_OK);
    }

    // ------------------------------------------------------
    // -
    // -    Internal Methods
    // -
    // ------------------------------------------------------

    protected function _formatOne(Material $material): array
    {
        return $material->serialize(Material::SERIALIZE_DETAILS);
    }
}
