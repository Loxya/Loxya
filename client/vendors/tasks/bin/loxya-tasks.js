#!/usr/bin/env node

import yargs from 'yargs';
import getArgs from '../utils/getArgs.js';

// - Handlers
import buildHandler from '../scripts/build.js';
import serveHandler from '../scripts/serve.js';
import testHandler from '../scripts/test.js';

// - Fait échouer le script en cas de promesse rejetée non gérée,
//   au lieu de les ignorer silencieusement.
process.on('unhandledRejection', (err) => { throw err; });

yargs()
    .command({
        command: 'build',
        desc: 'Permet de compiler le front-end du projet.',
        handler: buildHandler,
        builder: {
            watch: {
                type: 'boolean',
                alias: 'w',
                describe: 'Observe les modifications des fichiers.',
            },
            production: {
                type: 'boolean',
                describe: `Compile le projet pour l'environnement de production.`,
            },
            silent: {
                type: 'boolean',
                description: `Affiche moins d'informations (mode silencieux).`,
            },
        },
    })
    .command({
        command: 'serve',
        desc: 'Lance une session de développement front-end.',
        handler: serveHandler,
    })
    .command({
        command: 'test',
        desc: 'Exécute les tests unitaires front-end.',
        handler: testHandler,
        builder: {
            all: {
                type: 'boolean',
                description: (
                    `Exécute tous les tests au lieu d'exécuter uniquement ceux ` +
                    'des fichiers modifiés depuis le dernier commit.'
                ),
            },
            bail: {
                type: 'boolean',
                alias: 'b',
                description: 'Arrête immédiatement après `n` tests échoués.',
            },
            ci: {
                type: 'boolean',
                description: (
                    'Exécute les tests en mode intégration continue (CI). Cette option ' +
                    `empêche l'écriture de snapshots sauf si elle est explicitement demandée.`
                ),
            },
            color: {
                type: 'boolean',
                description: (
                    'Force la coloration du résultat des tests (même si la sortie ' +
                    `standard n'est pas un TTY). Mettre à false pour désactiver les couleurs.`
                ),
            },
            coverage: {
                type: 'boolean',
                description: (
                    'Indique que les informations de couverture de tests doivent être ' +
                    'collectées et affichées.'
                ),
            },
            onlyFailures: {
                alias: 'f',
                type: 'boolean',
                description: 'Exécute uniquement les tests ayant échoué précédemment.',
            },
            passWithNoTests: {
                type: 'boolean',
                description: `Ne provoque pas d'échec si aucun test n'est trouvé.`,
            },
            updateSnapshot: {
                alias: 'u',
                type: 'boolean',
                description: 'Réenregistre les snapshots.',
            },
            watch: {
                type: 'boolean',
                description: (
                    'Surveille les fichiers modifiés et relance les tests associés. ' +
                    `Pour relancer tous les tests lorsqu'un fichier change, utilisez l'option \`--watchAll\`.`
                ),
            },
            watchAll: {
                type: 'boolean',
                description: (
                    'Surveille les fichiers et relance tous les tests. Pour ne relancer ' +
                    'que ceux liés aux fichiers modifiés, utilisez `--watch`.'
                ),
            },
            verbose: {
                type: 'boolean',
                description: `Affiche plus d'informations sur chaque test.`,
            },
        },
    })
    .demandCommand()
    .help('help')
    .strict()
    .parse(getArgs(true));
