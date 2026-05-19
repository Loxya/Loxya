import ora from 'ora';
import colors from 'picocolors';
import clearConsole from './clearConsole.js';
import outputWebpackBuildErrors from './outputWebpackBuildErrors.js';

const isInteractive = process.stdout.isTTY;

const wrapServeCompiler = function(compiler, options = {}) {
    options = { events: {}, afterCompile: null, ...options };
    const events = { invalid: 'invalid', done: 'done', ...options.events };

    let spinner;

    // - Déclenché lorsque Webpack considère que le bundle a été invalidé.
    //   (modification de fichier, etc.)
    let isCompiling = false;
    compiler.hooks.invalid.tap(events.invalid, () => {
        if (isCompiling) {
            return;
        }
        isCompiling = true;

        if (isInteractive) {
            clearConsole();
        }

        spinner = ora('Compilation en cours...').start();
    });

    // - Déclenché lorsque Webpack a terminé la recompilation du bundle.
    let isFirstSuccessfulBuild = true;
    compiler.hooks.done.tap(events.done, (stats) => {
        if (spinner) {
            spinner.stop();
        }

        isCompiling = false;
        if (isInteractive) {
            clearConsole();
        }

        const isSuccessful = !stats.hasErrors() && !stats.hasWarnings();
        if (isSuccessful) {
            console.log(colors.green('Compilation terminée.'));
            if (options.afterCompile) {
                options.afterCompile(isFirstSuccessfulBuild);
            }
            isFirstSuccessfulBuild = false;
            return;
        }

        outputWebpackBuildErrors(stats);
    });

    return compiler;
};

export default wrapServeCompiler;
