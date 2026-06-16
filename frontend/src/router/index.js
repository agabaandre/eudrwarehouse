import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '@/views/HomeView.vue';
import AnalyticsView from '@/views/AnalyticsView.vue';
import ManagementView from '@/views/ManagementView.vue';
import MapsView from '@/views/MapsView.vue';
import RegistrationView from '@/views/RegistrationView.vue';

const PUBLIC_SEO = {
  home: {
    title: 'MAAIF EUDR Compliance Platform | Uganda',
    description: 'National platform for EU Deforestation Regulation compliance — register farmers, trace supply chains, monitor geospatial risk, and access real-time analytics.',
  },
  analytics: {
    title: 'EUDR Analytics Dashboard | MAAIF Uganda',
    description: 'Public analytics on coffee production, district compliance, export performance, and deforestation risk across Uganda.',
  },
  maps: {
    title: 'Geospatial Maps | MAAIF EUDR Platform',
    description: 'Interactive maps of Uganda districts, coffee belt, deforestation risk zones, and farm plot clusters for EUDR compliance.',
  },
  registration: {
    title: 'Farmer & Exporter Registration | MAAIF EUDR',
    description: 'Register farmers and exporters, manage supply chains, access training, and receive SMS compliance alerts via web or USSD *284#.',
  },
};

const router = createRouter({
  history: createWebHistory(),
  scrollBehavior(to, from, saved) {
    if (saved) return saved;
    return { top: 0 };
  },
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
      meta: { seo: { ...PUBLIC_SEO.home, robots: 'index, follow' } },
    },
    {
      path: '/analytics',
      alias: '/analytics/',
      name: 'analytics',
      component: AnalyticsView,
      meta: { seo: { ...PUBLIC_SEO.analytics, robots: 'index, follow' } },
    },
    {
      path: '/management',
      alias: '/management/',
      name: 'management',
      component: ManagementView,
      meta: {
        private: true,
        seo: {
          title: 'Management Dashboard | MAAIF EUDR',
          description: 'Authenticated strategic dashboard for MAAIF officers.',
          robots: 'noindex, nofollow, noarchive, nosnippet',
        },
      },
    },
    {
      path: '/maps',
      alias: '/maps/',
      name: 'maps',
      component: MapsView,
      meta: { seo: { ...PUBLIC_SEO.maps, robots: 'index, follow' } },
    },
    {
      path: '/registration',
      alias: '/registration/',
      name: 'registration',
      component: RegistrationView,
      meta: { seo: { ...PUBLIC_SEO.registration, robots: 'index, follow' } },
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});

export default router;
