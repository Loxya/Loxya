<?php
declare(strict_types=1);

namespace Loxya\Console\Command\Migrations;

use Loxya\Config\Config;
use Phinx\Console\Command\Create as CoreCreateCommand;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;

#[AsCommand(name: 'migrations:create')]
final class CreateCommand extends CoreCreateCommand
{
    use ConfigurationTrait;

    protected function configure(): void
    {
        $this
            ->setDescription("Création d'une nouvelle migration.")
            ->addArgument('name', InputArgument::REQUIRED, "Nom de la classe de la migration (en CamelCase).");
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        // - Phinx utilise `environment` plutôt que `env`, donc on ajoute l'alias artificiellement.
        $this->addOption('environment', null, InputOption::VALUE_REQUIRED, '', Config::getEnv());

        // - Options volontairement non exposées (= ne font pas sens dans le contexte de l'application).
        foreach (['template', 'class', 'path', 'style'] as $coreOption) {
            $this->addOption($coreOption);
        }

        return parent::execute($input, $output);
    }
}
