import './index.scss';
import { defineComponent } from 'vue';

import type { PropType } from 'vue';
import type { GroupDetails } from '@/stores/api/groups';
import type { TechnicianDetails } from '@/stores/api/technicians';
import type { Role } from '@/stores/api/roles';

type Props = {
    /** Le technicien dont on veut afficher les détails. */
    technician: TechnicianDetails,
};

/** Onglet des informations d'un technicien. */
const TechnicianViewInfos = defineComponent({
    name: 'TechnicianViewInfos',
    props: {
        technician: {
            type: Object as PropType<Props['technician']>,
            required: true,
        },
    },
    computed: {
        completeName(): string {
            const { full_name: fullName, nickname } = this.technician;
            return !nickname ? fullName : `${fullName} "${nickname}"`;
        },

        email(): string | null {
            const { email, user } = this.technician;
            return email ?? user?.email ?? null;
        },

        userGroup(): GroupDetails | null {
            const { user } = this.technician;
            if (!user) {
                return null;
            }
            return this.$store.getters['groups/get'](user.group);
        },
    },
    mounted() {
        this.$store.dispatch('groups/fetch');
    },
    methods: {
        __(key: string, params?: Record<string, number | string>, count?: number): string {
            key = !key.startsWith('global.')
                ? `page.technician-view.infos.${key}`
                : key.replace(/^global\./, '');

            return this.$t(key, params, count);
        },
    },
    render() {
        const { __, completeName, email, userGroup } = this;
        const {
            phone,
            country,
            user,
            note,
            full_address: address,
            roles,
        } = this.technician;

        return (
            <div class="TechnicianViewInfos">
                <h2 class="TechnicianViewInfos__name">
                    {completeName}
                </h2>
                <section class="TechnicianViewInfos__main">
                    <div class="TechnicianViewInfos__main__contact">
                        <dl class="TechnicianViewInfos__info">
                            <dt class="TechnicianViewInfos__info__label">
                                {__('global.phone')}
                            </dt>
                            <dd class="TechnicianViewInfos__info__value">
                                {phone ?? (
                                    <span class="TechnicianViewInfos__info__empty">
                                        {__('global.not-specified')}
                                    </span>
                                )}
                            </dd>
                        </dl>
                        <dl class="TechnicianViewInfos__info">
                            <dt class="TechnicianViewInfos__info__label">
                                {__('global.email')}
                            </dt>
                            <dd class="TechnicianViewInfos__info__value">
                                {email ? <a href={`mailto:${email}`}>{email}</a> : (
                                    <span class="TechnicianViewInfos__info__empty">
                                        {__('global.not-specified')}
                                    </span>
                                )}
                            </dd>
                        </dl>
                        <dl class="TechnicianViewInfos__info">
                            <dt class="TechnicianViewInfos__info__label">
                                {__('global.address')}
                            </dt>
                            <dd class="TechnicianViewInfos__info__value">
                                {address ?? (
                                    <span class="TechnicianViewInfos__info__empty">
                                        {__('global.not-specified')}
                                    </span>
                                )}
                            </dd>
                        </dl>
                        <dl class="TechnicianViewInfos__info">
                            <dt class="TechnicianViewInfos__info__label">
                                {__('global.country')}
                            </dt>
                            <dd class="TechnicianViewInfos__info__value">
                                {country?.name ?? (
                                    <span class="TechnicianViewInfos__info__empty">
                                        {__('global.not-specified')}
                                    </span>
                                )}
                            </dd>
                        </dl>
                    </div>
                    <div class="TechnicianViewInfos__main__extras">
                        {!!user && (
                            <dl class="TechnicianViewInfos__info">
                                <dt class="TechnicianViewInfos__info__label">
                                    {__('user-account')}
                                </dt>
                                <dd class="TechnicianViewInfos__info__value">
                                    <span class="TechnicianViewInfos__pseudo">
                                        <span class="TechnicianViewInfos__pseudo__at">@</span>
                                        <span class="TechnicianViewInfos__pseudo__value">{user.pseudo}</span>
                                    </span>
                                    {userGroup !== null && (
                                        <span class="TechnicianViewInfos__user-group">({userGroup.name})</span>
                                    )}
                                </dd>
                            </dl>
                        )}
                        {!!note && (
                            <dl class="TechnicianViewInfos__info">
                                <dt class="TechnicianViewInfos__info__label">
                                    {__('notes')}
                                </dt>
                                <dd class="TechnicianViewInfos__info__value">
                                    {note}
                                </dd>
                            </dl>
                        )}
                        <dl class="TechnicianViewInfos__info">
                            <dt class="TechnicianViewInfos__info__label">
                                {__('roles.title')}
                            </dt>
                            <dd class="TechnicianViewInfos__info__value">
                                {roles.length === 0 && (
                                    <span class="TechnicianViewInfos__info__empty">
                                        {__('roles.empty')}
                                    </span>
                                )}
                                {roles.length > 0 && (
                                    <ul class="TechnicianViewInfos__roles">
                                        {roles.map((role: Role) => (
                                            <li key={role.id} class="TechnicianViewInfos__roles__item">
                                                {role.name}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </dd>
                        </dl>
                    </div>
                </section>
            </div>
        );
    },
});

export default TechnicianViewInfos;
