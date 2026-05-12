<?php
declare(strict_types=1);

namespace Loxya\Tests;

use Adbar\Dot as DotArray;
use Illuminate\Contracts\Support\Arrayable;
use Illuminate\Support\Carbon;
use Loxya\Config\Config;
use Loxya\Config\Enums\BillingMode;
use Loxya\Config\Enums\ReturnPolicy;
use Loxya\Config\Enums\WeightUnit;
use Loxya\Contracts\Serializable;
use Loxya\Kernel;
use Loxya\Models\User;
use Loxya\Services\Auth;
use Loxya\Services\Cache;
use Loxya\Support\Data\LegalType\LegalTypeFr;
use Loxya\Support\Invoicing\PaymentMethod;
use Loxya\Support\Invoicing\UblSpecification;
use Loxya\Support\JWT\JWT;
use Loxya\Support\Pdf\HybridPdf;
use Loxya\Support\Pdf\Pdf;
use Loxya\Support\Pdf\PdfInterface;
use Loxya\Support\Str;
use Loxya\Support\Validation\ValidationsException;
use Loxya\Support\Xml\XmlInterface;
use Loxya\Tests\Fixtures\Fixtures;
use Loxya\Tests\Fixtures\Snapshots\Drivers\FileDriver;
use Loxya\Tests\Fixtures\Snapshots\Drivers\HtmlDriver;
use PHPUnit\Framework\TestCase as CoreTestCase;
use Spatie\Snapshots\MatchesSnapshots;

abstract class TestCase extends CoreTestCase
{
    use MatchesSnapshots;

    protected function setUp(): void
    {
        if (!Kernel::booted()) {
            Fixtures::resetTestDatabase();
            Kernel::boot();
        }
        $container = Kernel::get()->getContainer();

        static::setCustomConfig();

        Fixtures::setupTestTransactions($container);

        Auth\Test::$user = User::findOrFail(1);
    }

    protected function tearDown(): void
    {
        $container = Kernel::get()->getContainer();

        // - Reset des transactions.
        Fixtures::resetTestTransactions($container);

        // - Reset du cache.
        $container->get('cache')->clear();

        // - Reset de l'authentification.
        Auth::reset();

        // - Reset du Kernel.
        Kernel::reset();

        // - Reset de la configuration.
        Config::deleteCustomConfig();

        // - Reset des helpers.
        Str::reset();

        // - Reset des dates.
        static::setNow(null);

        parent::tearDown();
    }

    protected function getSnapshotDirectory(): string
    {
        return TESTS_SNAPSHOTS_FOLDER;
    }

    // ------------------------------------------------------
    // -
    // -    Méthodes internes
    // -
    // ------------------------------------------------------

    protected static function setNow(\DateTimeInterface|null $now = null): void
    {
        if ($now === null) {
            if (Carbon::hasTestNow()) {
                Carbon::setTestNow(null);
            }
            if (Cache::hasTestNow()) {
                Cache::setTestNow(null);
            }
            if (JWT::hasTestNow()) {
                JWT::setTestNow(null);
            }
            return;
        }

        Carbon::setTestNow($now);
        Cache::setTestNow($now);
        JWT::setTestNow($now);
    }

    protected static function setCustomConfig(array $customValues = []): void
    {
        $config = new DotArray([
            'baseUrl' => 'http://loxya.test',
            'mainCountry' => 'FR',
            'defaultLang' => 'fr',
            'currency' => 'EUR',
            'enableCORS' => true,
            'useRouterCache' => false,
            'sessionExpireHours' => 12,
            'healthcheck' => true,
            'JWTSecret' => 'jwt_secret_for_tests',
            'httpAuthHeader' => 'Authorization',
            'returnPolicy' => ReturnPolicy::AUTO,
            'billingMode' => BillingMode::PARTIAL,
            'maxItemsPerPage' => 100,
            'maxConcurrentFetches' => 2,
            'organization' => [
                'name' => 'Testing corp.',
                'logo' => 'logo/test/logo-wide.png',
                'registrationId' => '54321008020145',
                'tradeRegistryCity' => 'TestGrandeVille',
                'isVatExempted' => false,
                'isVatDueOnInvoice' => true,
                'vatNumber' => 'FR85543210080',
                'activityCode' => '7729Z',
                'legalType' => LegalTypeFr::SARL,
                'shareCapital' => '1000',
                'street' => ['5 rue des tests'],
                'postalCode' => '05555',
                'locality' => 'Testville',
                'country' => 'FR',
                'phone' => '+33123456789',
                'email' => 'contact@testing-corp.dev',
            ],
            'invoices' => [
                'routingIdentifier' => '0225:543210080_54321008020145',
                'paymentMethods' => [
                    PaymentMethod::CHEQUE->value => true,
                    PaymentMethod::TRANSFER->value => [
                        'iban' => 'FR7630006000011234567890189',
                        'bic' => 'BNPAFRPPXXX',
                    ],
                ],
            ],
            'signup' => [
                'expireAfter' => 60,
                'maxRegistrationBeforeCooldown' => 2,
            ],
            'features' => [
                'technicians' => true,
            ],
            'email' => [
                'from' => 'testing@loxya.com',
            ],
            'measurementUnits' => [
                'materials' => [
                    'weight' => WeightUnit::KILOGRAM,
                ],
            ],
            'maxFileUploadSize' => 25 * 1024 * 1024,
        ]);

        $config = $config->set($customValues)->all();
        Config::saveCustomConfig($config);
    }

    // ------------------------------------------------------
    // -
    // -    Custom assertions
    // -
    // ------------------------------------------------------

    public function assertThrow($expectedException, callable $executor): void
    {
        $actualException = null;
        try {
            $executor();
        } catch (\Throwable $e) {
            $actualException = $e;
        }

        if ($expectedException instanceof \Throwable) {
            $this->assertInstanceOf(get_class($expectedException), $actualException);
            $this->assertSame($expectedException->getMessage(), $actualException->getMessage());
            $this->assertSame($expectedException->getCode(), $actualException->getCode());

            if ($expectedException instanceof ValidationsException) {
                /** @var ValidationsException $actualException */
                $this->assertSameCanonicalize(
                    $expectedException->getValidationErrors(),
                    $actualException->getValidationErrors(),
                );
            }
            return;
        }

        if (is_string($expectedException)) {
            if (class_exists($expectedException)) {
                $this->assertInstanceOf($expectedException, $actualException);
            } else {
                $this->assertStringContainsString($expectedException, $actualException->getMessage());
            }
            return;
        }

        if (is_int($expectedException)) {
            $this->assertSame($expectedException, $actualException->getCode());
            return;
        }

        throw new \InvalidArgumentException('Unsupported excepted exception type.');
    }

    public function assertNotThrow($expectedException, callable $executor): void
    {
        $actualException = null;
        try {
            $executor();
        } catch (\Throwable $e) {
            $actualException = $e;
        }

        if ($actualException === null) {
            $this->assertTrue(true);
            return;
        }

        if ($expectedException instanceof \Throwable) {
            $expectedExceptionClass = get_class($expectedException);
            if (!($actualException instanceof $expectedExceptionClass)) {
                $this->assertTrue(true);
                return;
            }

            $this->assertNotSame($expectedException->getMessage(), $actualException->getMessage());
            $this->assertNotSame($expectedException->getCode(), $actualException->getCode());

            if ($expectedException instanceof ValidationsException) {
                /** @var ValidationsException $actualException */
                $this->assertNotSameCanonicalize(
                    $expectedException->getValidationErrors(),
                    $actualException->getValidationErrors(),
                );
            }
        }

        if (is_string($expectedException)) {
            if (class_exists($expectedException)) {
                $this->assertNotInstanceOf($expectedException, $actualException);
            } else {
                $this->assertStringNotContainsString($expectedException, $actualException->getMessage());
            }
            return;
        }

        if (is_int($expectedException)) {
            $this->assertNotSame($expectedException, $actualException->getCode());
            return;
        }

        throw new \InvalidArgumentException('Unsupported excepted exception type.');
    }

    public function assertSameCanonicalize($expected, $actual, string $message = ''): void
    {
        $canonicalize = static function (&$value) use (&$canonicalize): void {
            if (is_object($value)) {
                if ($value instanceof Serializable) {
                    $value = $value->serialize();
                }
                if ($value instanceof Arrayable) {
                    $value = $value->toArray();
                }
            }
            if (is_array($value)) {
                ksort($value);
                foreach ($value as &$subValue) {
                    $canonicalize($subValue);
                }
            }
        };
        $canonicalize($expected);
        $canonicalize($actual);

        $this->assertSame($expected, $actual, $message);
    }

    public function assertNotSameCanonicalize($expected, $actual, string $message = ''): void
    {
        $canonicalize = static function (&$value) use (&$canonicalize): void {
            if (is_object($value)) {
                if ($value instanceof Serializable) {
                    $value = $value->serialize();
                }
                if ($value instanceof Arrayable) {
                    $value = $value->toArray();
                }
            }
            if (is_array($value)) {
                ksort($value);
                foreach ($value as &$subValue) {
                    $canonicalize($subValue);
                }
            }
        };
        $canonicalize($expected);
        $canonicalize($actual);

        $this->assertNotSame($expected, $actual, $message);
    }

    public function assertMatchesFileContentSnapshot($actual, string $extension): void
    {
        $this->assertMatchesSnapshot($actual, new FileDriver($extension));
    }

    public function assertMatchesHtmlSnapshot(string $actual): void
    {
        $this->assertMatchesSnapshot($actual, new HtmlDriver());
    }

    public function assertMatchesPdfSnapshot(PdfInterface $actual): void
    {
        // $this->assertMatchesFileContentSnapshot($actual->asBinaryString(), 'pdf');

        if ($actual instanceof Pdf || $actual instanceof HybridPdf) {
            $this->assertMatchesHtmlSnapshot($actual->getHtml());
        }
        if ($actual instanceof HybridPdf) {
            $this->assertMatchesXmlSnapshot($actual->getXml());
        }
    }

    public function assertValidFacturx(PdfInterface $actual): void
    {
        $this->assertInstanceOf(HybridPdf::class, $actual);
        /** @var HybridPdf $actual */

        $this->assertMatchesPdfSnapshot($actual);
        $this->assertSchema('factur-x-extended', $actual->getXml());
    }

    public function assertValidUbl(UblSpecification $specification, XmlInterface $actual): void
    {
        $this->assertMatchesXmlSnapshot($actual->getContent());

        switch ($specification) {
            case UblSpecification::PEPPOL_BIS_BILLING_3:
                $this->assertSchema('ubl-peppol-bis-billing-3', $actual->getContent());
                break;

            case UblSpecification::EXTENDED_CTC_FR:
                $this->assertSchema('ubl-extended-ctc-fr', $actual->getContent());
                break;

            default:
                throw new \InvalidArgumentException((
                    sprintf("Unsupported specification `%s`", $specification->value)
                ));
        }
    }

    protected function assertSchema(string $schemaName, string $xml): void
    {
        $schemaDir = TESTS_SCHEMAS_FOLDER . DS . $schemaName;
        if (!is_dir($schemaDir)) {
            throw new \LogicException(sprintf('Unable to retrieve `%s` schema.', $schemaName));
        }

        $xsdFile = $schemaDir . DS . 'schema.xsd';
        $hasStructuralSchema = is_file($xsdFile);

        $schFiles = glob($schemaDir . DS . '*.sch');
        $hasSchematronSchema = !empty($schFiles);

        if (!$hasStructuralSchema && !$hasSchematronSchema) {
            throw new \LogicException(sprintf('No structural or schematron schema found in `%s`.', $schemaName));
        }

        $document = tap(new \DOMDocument(), static fn (\DOMDocument $document) => (
            $document->loadXML($xml)
        ));

        //
        // - Validation de la structure.
        //

        if ($hasStructuralSchema) {
            libxml_use_internal_errors(true);
            libxml_clear_errors();
            $document->schemaValidate($xsdFile);
            $structuralErrors = array_map(
                static fn (\LibXMLError $error) => trim($error->message),
                libxml_get_errors(),
            );
            libxml_use_internal_errors(false);
            libxml_clear_errors();

            $this->assertEmpty($structuralErrors, vsprintf(
                "Structural validation failed with %d error(s):\n%s",
                [count($structuralErrors), implode("\n", $structuralErrors)],
            ));
        }

        //
        // - Validation des règles métier.
        //

        if (!$hasSchematronSchema) {
            return;
        }

        $documentXpath = new \DOMXPath($document);

        $isXPath2 = static fn (string $expression): bool => (
            str_contains($expression, 'xs:') ||
            str_contains($expression, 'upper-case(') ||
            str_contains($expression, 'lower-case(') ||
            (bool) preg_match('/\b(matches|exists|empty)\(/', $expression) ||
            (bool) preg_match('/\b(for|every|some)\s+\$/', $expression) ||
            (bool) preg_match('/=\s*\(\'[^\']*\'\s*,/', $expression) ||
            str_contains($expression, 'castable as ') ||
            str_contains($expression, 'instance of ') ||
            (bool) preg_match('/=\s*(true|false)\(\)/', $expression)
        );

        $quote = static fn (string $str): string => (
            str_contains($str, "'")
                ? sprintf('"%s"', str_replace('"', '&quot;', $str))
                : sprintf("'%s'", $str)
        );

        $domainErrors = [];
        $enumsCache = [];

        libxml_use_internal_errors(true);
        libxml_clear_errors();
        foreach ($schFiles as $schFile) {
            $schema = new \DOMXPath(
                tap(new \DOMDocument(), static fn (\DOMDocument $doc) => (
                    $doc->loadXML(file_get_contents($schFile))
                )),
            );
            $schema->registerNamespace('iso', 'http://purl.oclc.org/dsdl/schematron');

            // - Enregistrement des namespaces déclarés dans le schématron courant.
            foreach ($schema->query('//iso:ns') as $ns) {
                /** @var \DOMElement $ns */
                $documentXpath->registerNamespace($ns->getAttribute('prefix'), $ns->getAttribute('uri'));
            }

            foreach ($schema->query('//iso:rule') as $rule) {
                /** @var \DOMElement $rule */
                $context = $rule->getAttribute('context');

                // - On ignore les expressions XPath 2.0 car `DOMXPath` ne supporte que XPath 1.0.
                if ($isXPath2($context)) {
                    continue;
                }

                $contextNodes = @$documentXpath->query($context);
                if ($contextNodes === false || $contextNodes->length === 0) {
                    continue;
                }

                foreach ($contextNodes as $contextNode) {
                    // - Variables (`<let>`).
                    $vars = [];
                    foreach ($schema->query('./iso:let', $rule) as $let) {
                        /** @var \DOMElement $let */
                        $rawValue = $let->getAttribute('value');

                        // - On ignore les expressions XPath 2.0 car `DOMXPath` ne supporte que XPath 1.0.
                        if ($isXPath2($rawValue)) {
                            continue;
                        }

                        libxml_clear_errors();
                        $value = @$documentXpath->evaluate(sprintf('string(%s)', $rawValue), $contextNode);
                        if (empty(libxml_get_errors()) && is_string($value)) {
                            $vars[$let->getAttribute('name')] = $value;
                        }
                    }

                    // - Assertions.
                    foreach ($schema->query('./iso:assert', $rule) as $assert) {
                        /** @var \DOMElement $assert */
                        $test = $assert->getAttribute('test');
                        $message = trim($assert->textContent);

                        // - On ignore les expressions XPath 2.0 car `DOMXPath` ne supporte que XPath 1.0.
                        if ($isXPath2($test)) {
                            continue;
                        }

                        // - Substitution des variables.
                        foreach ($vars as $name => $value) {
                            $test = str_replace('$' . $name, $quote($value), $test);
                        }

                        // - Assertions via liste de codes.
                        $test = preg_replace_callback(
                            "/document\('(?P<file>[^']+)'\)(?:\/[^\/\[]+)*\/cl\[@id=(?P<id>\d+)\]\/enumeration\[@value=(?P<value>'[^']*'|\"[^\"]*\")\]/",
                            static function (array $matches) use ($schemaDir, &$enumsCache): string {
                                $codeListPath = $schemaDir . DS . $matches['file'];
                                if (!is_file($codeListPath)) {
                                    return 'false()';
                                }

                                $enumsCache[$codeListPath] ??= new \DOMXPath(
                                    tap(new \DOMDocument(), static fn (\DOMDocument $doc) => (
                                        $doc->load($codeListPath)
                                    )),
                                );
                                $found = $enumsCache[$codeListPath]->evaluate(vsprintf(
                                    'boolean(//cl[@id=%d]/enumeration[@value=%s])',
                                    [(int) $matches['id'], $matches['value']],
                                ));
                                return $found ? 'true()' : 'false()';
                            },
                            $test,
                        );

                        libxml_clear_errors();
                        $result = @$documentXpath->evaluate(sprintf('boolean(%s)', $test), $contextNode);
                        $hasXPathError = !empty(libxml_get_errors());

                        if (!$hasXPathError && $result === false) {
                            $domainErrors[] = $message;
                        }
                    }
                }
            }
        }
        libxml_use_internal_errors(false);
        libxml_clear_errors();

        $this->assertEmpty($domainErrors, vsprintf(
            "Domain validation failed with %d error(s):\n%s",
            [count($domainErrors), implode("\n", $domainErrors)],
        ));
    }
}
