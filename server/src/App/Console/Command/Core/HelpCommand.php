<?php
declare(strict_types=1);

namespace Loxya\Console\Command\Core;

use Symfony\Component\Console\Command\HelpCommand as CoreHelpCommand;

final class HelpCommand extends CoreHelpCommand
{
    protected function configure(): void
    {
        parent::configure();

        $this
            ->setDescription("Affiche l'aide pour une commande.")
            ->setHelp(implode(PHP_EOL, [
                "La commande <info>%command.name%</info> affiche l'aide pour une commande donnée :",
                "",
                "  <info>%command.full_name% list</info>",
                "",
                "Pour afficher la liste des commandes disponibles, utilisez la commande <info>list</info>.",
            ]))
            ->setHidden(true);
    }
}
