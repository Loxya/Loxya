import { defineComponent } from 'vue';

/** Pages des bookings (calendrier et liste). */
const Schedule = defineComponent({
    name: 'Schedule',
    render() {
        return <router-view key={this.$route.path} />;
    },
});

export { default as pages } from './pages';
export default Schedule;
