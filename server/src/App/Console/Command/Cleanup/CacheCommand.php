<?php
declare(strict_types=1);

namespace Loxya\Console\Command\Cleanup;

use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Filesystem\Filesystem;
use Symfony\Component\Finder\Finder;

#[AsCommand(name: 'cleanup:cache', aliases: ['clear:cache', 'cache:clear'])]
final class CacheCommand extends Command
{
    protected function configure(): void
    {
        $this
            ->setDescription("Efface le cache de l'application.")
            ->setHelp(implode(PHP_EOL, [
                "Cette commande videra tout le cache de l'application.",
                "",
                "<info>bin/console cleanup:cache</info>",
            ]));
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $cacheDir = realpath(CACHE_FOLDER);

        $filesystem = new Filesystem();
        if (!is_dir($cacheDir)) {
            try {
                $filesystem->mkdir($cacheDir, 0775);
            } catch (\Throwable) {
                // - On tente de créer le dossier de cache, s'il n'existe pas.
                //   (si ça échoue, on laisse passer car ce n'est pas le rôle
                //   principal de la commande)
            }

            $output->writeln("<info>Le cache a été correctement effacé.</info>");
            return Command::SUCCESS;
        }

        try {
            $files = Finder::create()
                ->in($cacheDir)
                ->depth(0)
                ->ignoreVCS(false)
                ->ignoreDotFiles(false)
                ->notName('.gitignore');

            if (count($files) > 0) {
                $filesystem->remove($files);
            }
        } catch (\Throwable $e) {
            $output->writeln(sprintf(
                "<error>Erreur lors de la suppression du cache : %s</error>",
                $e->getMessage(),
            ));
            return Command::FAILURE;
        }

        $output->writeln("<info>Le cache a été correctement effacé.</info>");
        return Command::SUCCESS;
    }
}
