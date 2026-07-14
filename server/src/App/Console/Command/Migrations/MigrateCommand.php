<?php
declare(strict_types=1);

namespace Loxya\Console\Command\Migrations;

use Loxya\Config\Config;
use Phinx\Console\Command\Migrate as CoreMigrateCommand;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;

#[AsCommand(name: 'migrations:migrate', aliases: ['migrate'])]
final class MigrateCommand extends CoreMigrateCommand
{
    use ConfigurationTrait {
        execute as private executeMigration;
    }

    /**
     * Code de sortie signalant que la configuration doit être mise
     * à jour manuellement avant de pouvoir migrer
     *
     * Note: Le code correspond au code `EX_CONFIG` de `sysexits.h`.
     *       (voir https://man7.org/linux/man-pages/man3/sysexits.h.3head.html)
     */
    private const EXIT_CONFIG_UPDATE_REQUIRED = 78;

    protected function configure(): void
    {
        /* phpcs:disable Generic.Files.LineLength.TooLong */
        $this
            ->setDescription("Migre la base de données.")
            ->setHelp(implode(PHP_EOL, [
                "La commande <info>migrate</info> exécute toutes les migrations disponibles.",
                "",
                "<info>bin/console migrate</info>",
                "<info>bin/console migrate --target 20211024081132</info>",
                "<info>bin/console migrate --date 20211024</info>",
                "<info>bin/console migrate --date 20211024 --fake</info>",
                "<info>bin/console migrate --dry-run</info>",
            ]))
            ->addOption('target', 't', InputOption::VALUE_REQUIRED, "Le numéro de migration jusqu'à laquelle migrer.")
            ->addOption('date', 'd', InputOption::VALUE_REQUIRED, "Le date jusqu'à laquelle vous souhaitez revenir.")
            ->addOption('dry-run', 'x', InputOption::VALUE_NONE, "Affiche les requêtes au lieu de les exécuter.")
            ->addOption('fake', null, InputOption::VALUE_REQUIRED, "Marque les migrations sélectionnées comme exécutées, sans pour autant exécuter quoi que ce soit.");
        /* phpcs:enable Generic.Files.LineLength.TooLong */
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        // - En environnement de test, la configuration est en mémoire...
        //   => On migre directement.
        if (Config::getEnv() === 'test') {
            return $this->executeMigration($input, $output);
        }

        // - S'il n'y a pas de configuration, les migrations ne peuvent pas être exécutées.
        if (!Config::customConfigExists()) {
            $output->writeln("<error>L'application doit être configurée avant le lancement des migrations.</error>");
            $output->writeln("<comment>Installez l'application via `bin/console install`.</comment>");
            return Command::FAILURE;
        }

        // - Si la configuration est obsolète, on tente de la migrer automatiquement...
        if (Config::isOutdated()) {
            $upgradedConfig = Config::getUpgradedCustomConfig();

            // - Si malgré tout la configuration n'est pas valide, c'est que des
            //   champs doivent être complétés à la main, on arrête donc là.
            if (!Config::isValid($upgradedConfig)) {
                $output->writeln("<error>La configuration doit être mise à jour avant les migrations.</error>");
                $output->writeln("<comment>Terminez la mise à jour via `bin/console install`.</comment>");
                return self::EXIT_CONFIG_UPDATE_REQUIRED;
            }

            Config::saveCustomConfig($upgradedConfig);
        }

        return $this->executeMigration($input, $output);
    }
}
