import invariant from 'invariant';
import currencies from './_data';

import type { CurrencyData } from './_data';

class Currency {
    private readonly _name: string;

    private readonly _code: string;

    private readonly _symbol: string | undefined;

    constructor(code: string | Currency) {
        this._code = !(code instanceof Currency)
            ? code.toUpperCase()
            : code.code;

        // - Récupère les données de la devise.
        const data: CurrencyData | undefined = currencies.find(
            (_datum: CurrencyData) => _datum.code === this._code,
        );
        invariant(data !== undefined, `Unknown currency: "${this._code}".`);

        this._name = data?.name ?? this._code;
        this._symbol = data?.symbol;
    }

    /**
     * Retourne le nom de la devise.
     *
     * @returns Le nom de la devise.
     */
    public get name(): string {
        return this._name;
    }

    /**
     * Retourne le code de la devise.
     *
     * @returns Le code de la devise.
     */
    public get code(): string {
        return this._code;
    }

    /**
     * Retourne le symbole de la devise.
     *
     * @returns Le symbole de la devise.
     */
    public get symbol(): string {
        return this._symbol ?? this._code;
    }

    /**
     * Retourne `true` si la devise est identique à une autre.
     *
     * @param other - La devise avec laquelle il faut comparer.
     *
     * @returns `true` si les devises sont identiques, `false` sinon.
     */
    public isSame(other: Currency): boolean {
        return this.code === other.code;
    }
}

export default Currency;
