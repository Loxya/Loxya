import './index.scss';
import { defineComponent } from 'vue';
import Illustration from './assets/illustration.svg?inline';
import Button from '@/themes/default/components/Button';

import type { PropType } from 'vue';

export enum ErrorType {
    /** La ressource n'a pas été trouvée. */
    NOT_FOUND = 'not-found',

    /** Une erreur critique inconnue. */
    UNKNOWN = 'unknown',
}

type Props = {
    /**
     * Type d'erreur critique.
     *
     * @default {@link ErrorType.UNKNOWN}
     */
    type?: ErrorType,

    /**
     * Personnalisation du message lié à l'erreur critique.
     *
     * Si cette prop. n'est pas spécifiée, le message par
     * défaut lié au type sera affiché.
     */
    message?: string,
};

/** Affichage d'une erreur critique. */
const CriticalError = defineComponent({
    name: 'CriticalError',
    props: {
        message: {
            type: String as PropType<Props['message']>,
            default: undefined,
        },
        type: {
            type: String as PropType<Required<Props>['type']>,
            default: ErrorType.UNKNOWN,
            validator: (value: unknown): boolean => (
                typeof value === 'string' &&
                (Object.values(ErrorType) as string[]).includes(value)
            ),
        },
    },
    computed: {
        displayMessage(): string {
            const { $t: __, message, type } = this;

            if (message) {
                return message;
            }

            return type === ErrorType.NOT_FOUND
                ? __('errors.page-not-found')
                : __('errors.critical');
        },
    },
    methods: {
        handleRefresh() {
            window.location.reload();
        },
    },
    render() {
        const { $t: __, displayMessage, type, handleRefresh } = this;

        const renderButton = (): JSX.Element => {
            if (type === ErrorType.NOT_FOUND) {
                return (
                    <Button to={{ name: 'home' }} type="primary" class="CriticalError__back-to-home">
                        {__('back-to-home')}
                    </Button>
                );
            }
            return (
                <Button onClick={handleRefresh} type="primary" class="CriticalError__refresh">
                    {__('refresh-page')}
                </Button>
            );
        };

        return (
            <div class="CriticalError">
                <Illustration class="CriticalError__illustration" />
                <p class="CriticalError__message">{displayMessage}</p>
                {renderButton()}
            </div>
        );
    },
});

export default CriticalError;
