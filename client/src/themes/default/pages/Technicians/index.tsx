import config from '@/globals/config';
import { defineComponent } from 'vue';

/** Pages des techniciens (calendrier et liste). */
const Technicians = defineComponent({
    name: 'Technicians',
    computed: {
        isEnabled(): boolean {
            return config.features.technicians;
        },
    },
    mounted() {
        if (!this.isEnabled) {
            this.$router.replace({ name: 'home' });
        }
    },
    render() {
        return <router-view key={this.$route.path} />;
    },
});

export { default as pages } from './pages';
export default Technicians;
