import type { Raw } from 'vue';
import type Day from '@/utils/day';
import type Period from '@/utils/period';
import type { Props as IconProps } from '@/themes/default/components/Icon';
import type { TERM_TOKEN_TYPE, TokenKind } from './_constants';
import type { SetOptional, SetRequired, Simplify } from 'type-fest';

export type OptionValue = string | number | typeof TERM_TOKEN_TYPE | boolean;

export type Option<T extends OptionValue = OptionValue, D = unknown> = {
    /**
     * L'éventuel icône à utilise pour cette option.
     *
     * Doit contenir une chaîne de caractère avec les composantes suivantes séparées par `:` :
     * - Le nom de l'icône sous forme de chaîne (e.g. `plus`, `wrench`)
     *   Pour une liste exhaustive des codes, voir: https://fontawesome.com/v5.15/icons?m=free
     * - La variante à utiliser de l'icône à utiliser (`solid`, `regular`, ...).
     *
     * @example
     * - `wrench`
     * - `wrench:solid`
     */
    icon?: string | `${string}:${Required<IconProps>['variant']}` | undefined,

    /** Le libellé de l'option. */
    label: string,

    /** La valeur de l'option. */
    value: T,

    /** Est-ce l'option par défaut ? */
    default?: boolean,

    /** Éventuelles données additionnelles pour l'option. */
    data?: D,
};

export type TokenValue = (
    | string
    | number
    | Array<string | number>
    | boolean
    | Raw<Day>
    | Raw<Period>
);

export type TokenOperatorValue = string;

export type TokenOperator = {
    /**
     * Le libellé de l'opérateur tel qu'il sera
     * présenté à l'utilisateur final.
     *
     * @example "Supérieur à", "Différent de"
     */
    label: string,

    /**
     * Version courte du libellé de l'opérateur tel
     * qu'il sera présenté à l'utilisateur final.
     *
     * @example ">", "diff. de"
     */
    alias?: string,

    /**
     * Valeur de l'opérateur (telle qu'utilisé en interne).
     *
     * @example ">", "!="
     */
    value: TokenOperatorValue,
};

export type TermToken = {
    id: string | number,
    type: typeof TERM_TOKEN_TYPE,
    value: string,
};
export type CustomToken<T extends string = string, V extends TokenValue = TokenValue> = {
    id: string | number,
    type: T,
    operator: TokenOperatorValue | null,
    value: V,
};

export type Token = (
    | TermToken
    | CustomToken
);

export type PartialToken = (
    | Simplify<(
        & Omit<TermToken, 'value'>
        & { value: TermToken['value'] | null }
    )>
    | Simplify<(
        & Omit<CustomToken, 'operator' | 'value'>
        & {
            operator: CustomToken['operator'] | null,
            value: CustomToken['value'] | null,
        }
    )>
);

export type LooseToken = (
    | Simplify<SetOptional<TermToken, 'id'>>
    | Simplify<SetOptional<CustomToken, 'id'>>
);

export type LoosePartialToken<ExtraPartial extends boolean = false> = (
    | Simplify<SetOptional<
        (
            & Omit<SetOptional<TermToken, 'id'>, 'value'>
            & { value: TermToken['value'] | null }
        ),
        [ExtraPartial] extends [true] ? 'value' : never
    >>
    | Simplify<SetOptional<
        (
            & Omit<SetOptional<CustomToken, 'id'>, 'operator' | 'value'>
            & {
                operator: CustomToken['operator'] | null,
                value: CustomToken['value'] | null,
            }
        ),
        [ExtraPartial] extends [true] ? ('operator' | 'value') : never
    >>
);

export type RawCustomToken<T extends string = string, V extends TokenValue = TokenValue> = (
    Simplify<(
        & Omit<CustomToken<T, V>, 'id' | 'operator'>
        & { operator?: TokenOperatorValue }
    )>
);

export type RawToken = (
    | RawCustomToken
    | string
);

export type TokenOption<
    T extends string | number = string | number,
    D = unknown,
> = Option<T, D>;

export type TokenOptions<
    T extends string | number = string | number,
    D = unknown,
> = Array<TokenOption<T, D>>;

type TokenDefinitionBase = {
    /**
     * Identifiant unique du type de token (= Un identifiant
     * quelconque ayant du sens pour l'utilisateur du component).
     *
     * Ce type doit être unique dans la liste des tokens disponibles car chaque
     * valeur ayant ce type utilisera la première configuration correspondante
     * définie dans cette prop.
     */
    type: CustomToken['type'],

    /**
     * L'éventuel icône à utiliser pour le token.
     *
     * Doit contenir une chaîne de caractère avec les composantes suivantes séparées par `:` :
     * - Le nom de l'icône sous forme de chaîne (e.g. `plus`, `wrench`)
     *   Pour une liste exhaustive des codes, voir: https://fontawesome.com/v5.15/icons?m=free
     * - La variante à utiliser de l'icône à utiliser (`solid`, `regular`, ...).
     *
     * @example
     * - `wrench`
     * - `wrench:solid`
     */
    icon?: string | `${string}:${Required<IconProps>['variant']}`,

    /**
     * Le titre du token tel qu'il sera affiché à l'utilisateur
     * final (e.g. "Parcs", "Auteurs").
     */
    title: string,

    /**
     * Les opérateurs à proposer pour ce type de token.
     *
     * Si cette prop. n'est pas définie, aucun opérateurs
     * personnalisé ne sera proposé (équivalent à `=`).
     */
    operators?: TokenOperator[],

    /**
     * Est-ce que ce type de token ne peut être présent qu'une seule fois ?
     * Si c'est le cas il ne sera donc pas possible de définir plusieurs valeur (e.g. "A" ou B").
     *
     * @default true
     */
    unique?: boolean,

    /**
     * Est-ce que le type de token est désactivé ?
     *
     * @default false
     */
    disabled?: boolean,
};

export type TokenDefinition<
    Strict extends boolean = true,
    T extends TokenOption = TokenOption,
> = SetRequired<
    (
        & TokenDefinitionBase
        & (
            | {
                /**
                 * La forme de valeur du token.
                 *
                 * Voir {@link TokenKind}
                 */
                kind: TokenKind.TEXT,

                /**
                 * Une éventuelle fonction de rendu pour customiser
                 * l'affichage de la valeur définie.
                 */
                render?(value: string): JSX.Node | null,
            }
            | {
                /**
                 * La forme de valeur du token.
                 *
                 * Voir {@link TokenKind}
                 */
                kind: (
                    | TokenKind.INTEGER
                    | TokenKind.FLOAT
                ),

                /**
                 * Une éventuelle fonction de rendu pour customiser
                 * l'affichage de la valeur définie.
                 */
                render?(value: number): JSX.Node | null,
            }
            | {
                /**
                 * La forme de valeur du token.
                 *
                 * Voir {@link TokenKind}
                 */
                kind: TokenKind.BOOLEAN,

                /**
                 * Une éventuelle fonction de rendu pour customiser l'affichage
                 * des options et/ou de la valeur sélectionnée.
                 */
                render?(value: boolean, asSelection: boolean): JSX.Node | null,
            }
            | {
                /**
                 * La forme de valeur du token.
                 *
                 * Voir {@link TokenKind}
                 */
                kind: TokenKind.DATE,

                /**
                 * Une éventuelle fonction de rendu pour customiser
                 * l'affichage de la valeur définie.
                 */
                render?(value: Raw<Day>): JSX.Node | null,
            }
            | {
                /**
                 * La forme de valeur du token.
                 *
                 * Voir {@link TokenKind}
                 */
                kind: TokenKind.PERIOD,

                /**
                 * Une éventuelle fonction de rendu pour customiser
                 * l'affichage de la valeur définie.
                 */
                render?(value: Raw<Period<true>>): JSX.Node | null,
            }
            | {
                /**
                 * La forme de valeur du token.
                 *
                 * Voir {@link TokenKind}
                 */
                kind?: TokenKind.LIST,

                /**
                 * Les options à proposer pour ce token.
                 * (e.g. La liste des utilisateurs pour un token de type "Utilisateur")
                 */
                options: T[],

                /**
                 * Est-ce que l'on doit autoriser la sélection de plusieurs valeurs pour un seul token ?
                 *
                 * Cette option diffère de `unique` dans le sens ou `unique` permet la sélection de
                 * plusieurs valeurs pour un même type dans plusieurs tokens différents avec éventuellement
                 * des opérateurs différents.
                 *
                 * @default false
                 */
                multiSelect?: false,

                /**
                 * Une éventuelle fonction de rendu pour customiser l'affichage
                 * des options et/ou de(s) valeur(s) sélectionnée(s).
                 */
                render?(option: T, asSelection: boolean): JSX.Node | null,
            }
            | {
                /**
                 * La forme de valeur du token.
                 *
                 * Voir {@link TokenKind}
                 */
                kind?: TokenKind.LIST,

                /**
                 * Les options à proposer pour ce token.
                 * (e.g. La liste des utilisateurs pour un token de type "Utilisateur")
                 */
                options: T[],

                /**
                 * Est-ce que l'on doit autoriser la sélection de plusieurs valeurs pour un seul token ?
                 *
                 * Cette option diffère de `unique` dans le sens ou `unique` permet la sélection de
                 * plusieurs valeurs pour un même type dans plusieurs tokens différents avec éventuellement
                 * des opérateurs différents.
                 *
                 * @default false
                 */
                multiSelect: true,

                /**
                 * Une éventuelle fonction de rendu pour customiser l'affichage
                 * des options et/ou de(s) valeur(s) sélectionnée(s).
                 */
                render?(options: T[], asSelection: true): JSX.Node | null,
                render?(options: T, asSelection: false): JSX.Node | null,
            }
        )
    ),
    Strict extends true ? 'kind' : never
>;

export type RawTokenDefinition<T extends TokenOption = TokenOption> = (
    TokenDefinition<false, T>
);
