<?php
declare(strict_types=1);

namespace Loxya\Console;

use DI\Container;
use Loxya\Config\Config;
use Loxya\Console\Command\Core\HelpCommand;
use Loxya\Console\Command\Core\ListCommand;
use Loxya\Kernel;
use Loxya\Services\I18n;
use Symfony\Component\Console\Application as BaseApplication;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputDefinition;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\ConsoleOutputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

final class App extends BaseApplication
{
    use Concerns\ConfiguresPrompts;

    private Container $container;

    private $commandsRegistered = false;
    private $registrationErrors = [];

    public function __construct()
    {
        $this->container = Kernel::boot()->getContainer();

        parent::__construct('Loxya', Config::getVersion());
    }

    public function doRun(InputInterface $input, OutputInterface $output)
    {
        $this->registerCommands();

        if ($this->registrationErrors) {
            $this->renderRegistrationErrors($input, $output);
        }

        $this->configurePrompts($input, $output);

        return parent::doRun($input, $output);
    }

    public function find(string $name)
    {
        $this->registerCommands();

        return parent::find($name);
    }

    public function get(string $name)
    {
        $this->registerCommands();

        return parent::get($name);
    }

    public function all(?string $namespace = null)
    {
        $this->registerCommands();

        return parent::all($namespace);
    }

    public function add(Command $command)
    {
        $this->registerCommands();

        return parent::add($command);
    }

    // ------------------------------------------------------
    // -
    // -    Méthodes internes.
    // -
    // ------------------------------------------------------

    protected function doRunCommand(Command $command, InputInterface $input, OutputInterface $output)
    {
        if (!$command instanceof ListCommand) {
            if ($this->registrationErrors) {
                $this->renderRegistrationErrors($input, $output);
                $this->registrationErrors = [];
            }

            return parent::doRunCommand($command, $input, $output);
        }

        $returnCode = parent::doRunCommand($command, $input, $output);

        if ($this->registrationErrors) {
            $this->renderRegistrationErrors($input, $output);
            $this->registrationErrors = [];
        }

        return $returnCode;
    }

    protected function getDefaultInputDefinition(): InputDefinition
    {
        $translate = function (string $key): string {
            /** @var I18n $i18n */
            $i18n = $this->container->get('i18n');
            return $i18n->translate(sprintf('console.global-args.%s', $key));
        };

        return new InputDefinition([
            new InputArgument('command', InputArgument::REQUIRED, $translate('command')),
            new InputOption('--env', '-e', InputOption::VALUE_REQUIRED, $translate('env'), Config::getEnv()),
            new InputOption('--help', '-h', InputOption::VALUE_NONE, $translate('help')),
            new InputOption('--quiet', '-q', InputOption::VALUE_NONE, $translate('quiet')),
            new InputOption('--version', '-V', InputOption::VALUE_NONE, $translate('version')),
        ]);
    }

    protected function getDefaultCommands(): array
    {
        return [
            new HelpCommand(),
            new ListCommand(),
        ];
    }

    protected function registerCommands(): void
    {
        if ($this->commandsRegistered) {
            return;
        }
        $this->commandsRegistered = true;

        if ($this->container->has('console.commands')) {
            foreach ($this->container->get('console.commands') as $command) {
                try {
                    $this->add($command);
                } catch (\Throwable $e) {
                    $this->registrationErrors[] = $e;
                }
            }
        }
    }

    protected function renderRegistrationErrors(InputInterface $input, OutputInterface $output): void
    {
        if ($output instanceof ConsoleOutputInterface) {
            $output = $output->getErrorOutput();
        }

        (new SymfonyStyle($input, $output))->warning('Some commands could not be registered:');

        foreach ($this->registrationErrors as $error) {
            $this->doRenderThrowable($error, $output);
        }
    }
}
