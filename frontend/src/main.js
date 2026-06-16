import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import i18n from './i18n';
import { setupRouterSeo } from '@/composables/useSeo';
import './assets/styles.css';

const app = createApp(App);
app.use(router);
app.use(i18n);
setupRouterSeo(router);
app.mount('#app');
