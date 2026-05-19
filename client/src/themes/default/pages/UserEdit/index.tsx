import './index.scss';
import { defineComponent } from 'vue';
import { RequestError, HttpCode } from '@/globals/requester';
import parseInteger from '@/utils/parseInteger';
import { ApiErrorCode } from '@/stores/api/@codes';
import Page from '@/themes/default/components/Page';
import CriticalError, { ErrorType } from '@/themes/default/components/CriticalError';
import Loading from '@/themes/default/components/Loading';
import Form from './components/Form';
import apiUsers from '@/stores/api/users';

import type { ComponentRef } from 'vue';
import type { UserEdit as UserEditType, UserDetails } from '@/stores/api/users';

type Data = {
    id: number | null,
    isFetched: boolean,
    isSaving: boolean,
    user: UserDetails | null,
    criticalError: ErrorType | null,
    validationErrors: Partial<Record<keyof UserEditType, string>> | null,
};

/** Page d'edition d'un utilisateur. */
const UserEdit = defineComponent({
    name: 'UserEdit',
    data(): Data {
        return {
            id: parseInteger(this.$route.params.id),
            isFetched: false,
            isSaving: false,
            user: null,
            criticalError: null,
            validationErrors: null,
        };
    },
    computed: {
        isNew(): boolean {
            return this.id === null;
        },

        pageTitle(): string {
            const { $t: __, isNew, isFetched, user } = this;

            if (isNew) {
                return __('page.user.title-create');
            }

            return isFetched && user !== null
                ? __('page.user.title-edit', { name: user.pseudo })
                : __('page.user.title-edit-simple');
        },
    },
    mounted() {
        this.$store.dispatch('parks/fetch');

        this.fetchData();
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleSubmit(data: UserEditType) {
            this.save(data);
        },

        handleCancel() {
            this.$router.back();
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        async fetchData() {
            if (this.isNew) {
                this.user = null;
                this.isFetched = true;
                return;
            }

            try {
                this.user = await apiUsers.one(this.id!);
                this.isFetched = true;
            } catch (error) {
                if (error instanceof RequestError && error.httpCode === HttpCode.NotFound) {
                    this.criticalError = ErrorType.NOT_FOUND;
                    return;
                }

                // eslint-disable-next-line no-console
                console.error(`Error occurred while retrieving user #${this.id!} data`, error);
                this.criticalError = ErrorType.UNKNOWN;
            }
        },

        async save(data: UserEditType) {
            if (this.isSaving) {
                return;
            }

            const { $t: __ } = this;
            this.isSaving = true;

            const doRequest = (): Promise<UserDetails> => (
                !this.isNew
                    ? apiUsers.update(this.id!, data)
                    : apiUsers.create(data)
            );

            try {
                const user = await doRequest();
                if (!this.isNew) {
                    this.user = user;
                }

                this.validationErrors = null;

                // - Redirection...
                this.$toasted.success(__('page.user.saved'));
                this.$router.push({ name: 'users' });
            } catch (error) {
                this.isSaving = false;

                if (error instanceof RequestError && error.code === ApiErrorCode.VALIDATION_FAILED) {
                    this.validationErrors = { ...error.details };
                    (this.$refs.page as ComponentRef<typeof Page>)?.scrollToTop();
                    return;
                }

                // eslint-disable-next-line no-console
                console.error(`Error occurred while saving the user`, error);
                this.$toasted.error(__('errors.unexpected-while-saving'));
            }
        },
    },
    render() {
        const {
            pageTitle,
            isSaving,
            isFetched,
            user,
            handleSubmit,
            handleCancel,
            criticalError,
            validationErrors,
        } = this;

        if (criticalError || !isFetched) {
            return (
                <Page name="user-edit" title={pageTitle} centered>
                    {criticalError ? <CriticalError type={criticalError} /> : <Loading />}
                </Page>
            );
        }

        return (
            <Page
                ref="page"
                name="user-edit"
                title={pageTitle}
                hasValidationError={!!validationErrors}
            >
                <div class="UserEdit">
                    <Form
                        savedData={user}
                        isSaving={isSaving}
                        errors={validationErrors}
                        onSubmit={handleSubmit}
                        onCancel={handleCancel}
                    />
                </div>
            </Page>
        );
    },
});

export default UserEdit;
