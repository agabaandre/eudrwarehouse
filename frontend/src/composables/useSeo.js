import { onMounted, onUnmounted, watch } from 'vue';

const DEFAULTS = {
  title: 'MAAIF EUDR Compliance Platform',
  description: 'Uganda\'s national platform for EU Deforestation Regulation compliance — farmer registration, supply chain traceability, geospatial risk maps, and real-time analytics.',
  image: '/og-image.svg',
  type: 'website',
  robots: 'index, follow',
  canonical: '',
};

function upsertMeta(attr, key, content) {
  if (!content) return;
  let el = document.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertLink(rel, href) {
  if (!href) return;
  let el = document.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

function applySeo(opts = {}) {
  const merged = { ...DEFAULTS, ...opts };
  const base = (import.meta.env.VITE_PUBLIC_BASE_URL || window.location.origin).replace(/\/$/, '');
  const title = merged.title;
  const description = merged.description;
  const canonical = merged.canonical || `${base}${window.location.pathname}`;

  document.title = title;
  upsertMeta('name', 'description', description);
  upsertMeta('name', 'robots', merged.robots);
  upsertMeta('name', 'theme-color', '#0d5c28');
  upsertMeta('property', 'og:title', title);
  upsertMeta('property', 'og:description', description);
  upsertMeta('property', 'og:type', merged.type);
  upsertMeta('property', 'og:url', canonical);
  upsertMeta('property', 'og:image', merged.image.startsWith('http') ? merged.image : `${base}${merged.image}`);
  upsertMeta('property', 'og:site_name', 'MAAIF EUDR Platform');
  upsertMeta('name', 'twitter:card', 'summary_large_image');
  upsertMeta('name', 'twitter:title', title);
  upsertMeta('name', 'twitter:description', description);
  upsertLink('canonical', canonical);
}

export function useSeo(options) {
  if (typeof options === 'function') {
    onMounted(() => applySeo(options()));
    return;
  }

  onMounted(() => applySeo(options));
  if (options && typeof options === 'object' && 'value' in options) {
    watch(options, (v) => applySeo(v), { deep: true });
  }
}

export function setupRouterSeo(router) {
  router.afterEach((to) => {
    const meta = to.meta.seo || {};
    applySeo({
      title: meta.title || DEFAULTS.title,
      description: meta.description || DEFAULTS.description,
      robots: meta.robots || DEFAULTS.robots,
      canonical: meta.canonical,
      type: meta.type || 'website',
    });
  });
}

export { applySeo, DEFAULTS };
