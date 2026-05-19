<?php
declare(strict_types=1);

namespace Loxya\Console\Concerns;

use Laravel\Prompts\ConfirmPrompt;
use Laravel\Prompts\MultiSearchPrompt;
use Laravel\Prompts\MultiSelectPrompt;
use Laravel\Prompts\PasswordPrompt;
use Laravel\Prompts\PausePrompt;
use Laravel\Prompts\Prompt;
use Laravel\Prompts\SearchPrompt;
use Laravel\Prompts\SelectPrompt;
use Laravel\Prompts\SuggestPrompt;
use Laravel\Prompts\TextareaPrompt;
use Laravel\Prompts\TextPrompt;
use Loxya\Config\Config;
use Loxya\Support\Arr;
use Loxya\Support\Validation\ValidationException;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Question\ChoiceQuestion;
use Symfony\Component\Console\Question\Question;
use Symfony\Component\Console\Style\SymfonyStyle;

/**
 * This trait is highly based on Taylor Otwell work on `laravel/framework`
 * package (https://github.com/laravel/framework/). This package
 * is subject to the MIT License whose terms are as follows:
 *
 *    Copyright (c) Taylor Otwell
 *
 *    Permission is hereby granted, free of charge, to any person
 *    obtaining a copy of this software and associated documentation
 *    files (the "Software"), to deal in the Software without restriction,
 *    including without limitation the rights to use, copy, modify, merge,
 *    publish, distribute, sublicense, and/or sell copies of the Software,
 *    and to permit persons to whom the Software is furnished to do so,
 *    subject  to the following conditions:
 *
 *    The above copyright notice and this permission notice shall be
 *    included in all copies or substantial portions of the Software.
 *
 *    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 *    EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 *    OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE
 *    AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 *    HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 *    WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 *    FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE
 *    OR OTHER DEALINGS IN THE SOFTWARE.
 */
trait ConfiguresPrompts
{
    protected function configurePrompts(InputInterface $input, OutputInterface $output)
    {
        Prompt::setOutput($output);

        // - Active le mode interactif des prompts uniquement si :
        //   - L'entrée est bien un terminal interactif (STDIN défini et attaché à un TTY),
        //   - Ou si on est dans des tests unitaires.
        Prompt::interactive(
            ($input->isInteractive() && defined('STDIN') && stream_isatty(STDIN)) ||
            Config::getEnv() === 'test',
        );

        // - Fallback vers l'implémentation `Question` de Symfony si
        //   on est dans des tests ou sous Windows (vu que ce n'est
        //   pas pris en charge hors WSL).
        //  Voir https://laravel.com/docs/12.x/prompts#fallbacks
        Prompt::fallbackWhen(windows_os() || Config::getEnv() === 'test');

        //
        // - Fallbacks
        //

        $promptUntilValid = static function (\Closure $prompt, bool|string $required, mixed $validate) use ($output) {
            while (true) {
                $result = $prompt();

                if ($required && ($result === '' || $result === [] || $result === false)) {
                    $output->writeln(sprintf('<error>%s</error>', is_string($required) ? $required : 'Required.'));

                    if (Config::getEnv() === 'test') {
                        throw new ValidationException();
                    } else {
                        continue;
                    }
                }

                // - Voir https://github.com/laravel/prompts/blob/v0.3.6/src/Prompt.php#L390
                if ($validate !== null) {
                    if (!is_callable($validate)) {
                        throw new \RuntimeException("The validation logic is missing.");
                    }

                    $error = $validate($result);
                    if (!is_string($error) && !is_null($error)) {
                        throw new \RuntimeException("The validator must return a string or null.");
                    }

                    if (is_string($error) && strlen($error) > 0) {
                        $output->writeln(sprintf('<error>%s</error>', $error));

                        if (Config::getEnv() === 'test') {
                            throw new ValidationException($error);
                        } else {
                            continue;
                        }
                    }
                }

                return $result;
            }
        };

        $selectFallback = static function (
            string $label,
            array $options,
            string|int|null $default = null,
        ) use (
            $input,
            $output,
        ): string|int {
            $getChoiceQuestion = static fn (string $question, array $choices, mixed $default) => (
                new class ($question, $choices, $default) extends ChoiceQuestion {
                    protected function isAssoc(array $array): bool
                    {
                        return Arr::isAssoc($array);
                    }
                }
            );
            $question = $getChoiceQuestion($label, $options, $default)
                ->setMaxAttempts(null)
                ->setMultiselect(false);

            $answer = (new SymfonyStyle($input, $output))->askQuestion($question);
            if (Arr::isAssoc($options) && $answer === (string) (int) $answer) {
                return (int) $answer;
            }

            return $answer;
        };

        $multiselectFallback = static function (
            string $label,
            array $options,
            array $default = [],
            bool|string $required = false,
        ) use (
            $input,
            $output,
        ): array {
            $default = $default !== [] ? implode(',', $default) : null;

            if ($required === false && Config::getEnv() !== 'test') {
                $options = Arr::isList($options)
                    ? ['None', ...$options]
                    : ['' => 'None'] + $options;

                if ($default === null) {
                    $default = 'None';
                }
            }

            $getChoiceQuestion = static fn (string $question, array $choices, mixed $default) => (
                new class ($question, $choices, $default) extends ChoiceQuestion {
                    protected function isAssoc(array $array): bool
                    {
                        return Arr::isAssoc($array);
                    }
                }
            );
            $question = $getChoiceQuestion($label, $options, $default)
                ->setMaxAttempts(null)
                ->setMultiselect(true);

            $answers = (new SymfonyStyle($input, $output))->askQuestion($question);
            if (Arr::isAssoc($options)) {
                $answers = array_map(
                    static fn ($value) => $value === (string) (int) $value ? (int) $value : $value,
                    $answers,
                );
            }

            if ($required === false) {
                return Arr::isList($options)
                    ? array_values(array_filter($answers, static fn ($value) => $value !== 'None'))
                    : array_filter($answers, static fn ($value) => $value !== '');
            }

            return $answers;
        };

        TextPrompt::fallbackUsing(static fn (TextPrompt $prompt) => $promptUntilValid(
            static function () use ($prompt, $input, $output) {
                $question = new Question($prompt->label, $prompt->default ?: null);

                return (new SymfonyStyle($input, $output))->askQuestion($question) ?? '';
            },
            $prompt->required,
            $prompt->validate,
        ));

        TextareaPrompt::fallbackUsing(static fn (TextareaPrompt $prompt) => $promptUntilValid(
            static function () use ($prompt, $input, $output) {
                $question = (new Question($prompt->label, $prompt->default ?: null))
                    ->setMultiline(true);

                return (new SymfonyStyle($input, $output))->askQuestion($question) ?? '';
            },
            $prompt->required,
            $prompt->validate,
        ));

        PasswordPrompt::fallbackUsing(static fn (PasswordPrompt $prompt) => $promptUntilValid(
            static function () use ($prompt, $input, $output) {
                $question = (new Question($prompt->label))
                    ->setHidden(true)
                    ->setHiddenFallback(true);

                return (new SymfonyStyle($input, $output))->askQuestion($question) ?? '';
            },
            $prompt->required,
            $prompt->validate,
        ));

        PausePrompt::fallbackUsing(static fn (PausePrompt $prompt) => $promptUntilValid(
            static function () use ($prompt, $input, $output) {
                $question = new Question($prompt->message, $prompt->value());
                (new SymfonyStyle($input, $output))->askQuestion($question);

                return $prompt->value();
            },
            $prompt->required,
            $prompt->validate,
        ));

        ConfirmPrompt::fallbackUsing(static fn (ConfirmPrompt $prompt) => $promptUntilValid(
            static fn () => (
                (new SymfonyStyle($input, $output))
                    ->confirm($prompt->label, $prompt->default)
            ),
            $prompt->required,
            $prompt->validate,
        ));

        SelectPrompt::fallbackUsing(static fn (SelectPrompt $prompt) => $promptUntilValid(
            static fn () => $selectFallback($prompt->label, $prompt->options, $prompt->default),
            false,
            $prompt->validate,
        ));

        MultiSelectPrompt::fallbackUsing(static fn (MultiSelectPrompt $prompt) => $promptUntilValid(
            static fn () => (
                $multiselectFallback(
                    $prompt->label,
                    $prompt->options,
                    $prompt->default,
                    $prompt->required,
                )
            ),
            $prompt->required,
            $prompt->validate,
        ));

        SuggestPrompt::fallbackUsing(static fn (SuggestPrompt $prompt) => $promptUntilValid(
            static function () use ($prompt, $input, $output) {
                $question = new Question($prompt->label, $prompt->default ?: null);

                is_callable($prompt->options)
                    ? $question->setAutocompleterCallback($prompt->options)
                    : $question->setAutocompleterValues($prompt->options);

                return (new SymfonyStyle($input, $output))->askQuestion($question) ?? '';
            },
            $prompt->required,
            $prompt->validate,
        ));

        SearchPrompt::fallbackUsing(static fn (SearchPrompt $prompt) => $promptUntilValid(
            static function () use ($prompt, $input, $output, $selectFallback) {
                $query = (new SymfonyStyle($input, $output))
                    ->askQuestion(new Question($prompt->label));

                $options = ($prompt->options)($query);
                return $selectFallback($prompt->label, $options);
            },
            false,
            $prompt->validate,
        ));

        MultiSearchPrompt::fallbackUsing(static fn (MultiSearchPrompt $prompt) => $promptUntilValid(
            static function () use ($prompt, $input, $output, $multiselectFallback) {
                $query = (new SymfonyStyle($input, $output))
                    ->askQuestion(new Question($prompt->label));

                $options = ($prompt->options)($query);
                return $multiselectFallback($prompt->label, $options, $prompt->required);
            },
            $prompt->required,
            $prompt->validate,
        ));
    }
}
