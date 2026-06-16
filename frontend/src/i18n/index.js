import { createI18n } from 'vue-i18n';
import en from './locales/en.js';
import lg from './locales/lg.js';
import sw from './locales/sw.js';
import nyn from './locales/nyn.js';
import teo from './locales/teo.js';
import ach from './locales/ach.js';
import xog from './locales/xog.js';

export const SUPPORTED_LOCALES = [
  { code: 'en', label: 'English' },
  { code: 'lg', label: 'Luganda' },
  { code: 'sw', label: 'Kiswahili' },
  { code: 'nyn', label: 'Runyankole' },
  { code: 'teo', label: 'Ateso' },
  { code: 'ach', label: 'Acholi' },
  { code: 'xog', label: 'Lusoga' },
];

const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('eudr_locale') : null;

const i18n = createI18n({
  legacy: false,
  locale: saved || 'en',
  fallbackLocale: 'en',
  messages: { en, lg, sw, nyn, teo, ach, xog },
});

export function setLocale(code) {
  i18n.global.locale.value = code;
  localStorage.setItem('eudr_locale', code);
}

export default i18n;
