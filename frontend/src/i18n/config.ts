import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from '@/locales/en.json';
import sr from '@/locales/sr.json';
import hu from '@/locales/hu.json';
import hi from '@/locales/hi.json';

export const supportedLngs = [
  'vi','hi','en','ko','am','ng','id','fil','ms','ur','bn','th','ru','pt','tr','de','fr','es','it','nl','pl','hu','cs','el','sr'
] as const;

const resources = {
  en: { translation: en },
  sr: { translation: sr },
  hu: { translation: hu },
  hi: { translation: hi },
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en',
    fallbackLng: 'en',
    supportedLngs: [...supportedLngs],
    interpolation: { escapeValue: false },
    returnNull: false,
  });

export default i18n;
