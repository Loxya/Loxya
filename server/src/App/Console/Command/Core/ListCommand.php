<?php
declare(strict_types=1);

namespace Loxya\Console\Command\Core;

use Symfony\Component\Console\Command\ListCommand as CoreListCommand;

final class ListCommand extends CoreListCommand
{
    protected function configure(): void
    {
        parent::configure();

        $this
            ->setDescription("Liste les commandes disponibles.")
            ->setHelp(implode(PHP_EOL, [
                "La commande <info>%command.name%</info> liste toutes les commandes et leurs descriptions :",
                "",
                "<info>%command.full_name%</info>",
                "",
                "Vous pouvez aussi lister les commandes d'une catégorie spécifique :",
                "",
                "<info>%command.full_name% migrations</info>",
            ]))
            ->setHidden(true);
    }
}
