/**
 * Translation Utilities
 * Simple translation system for i18n support
 */

import { en } from '../locales/en';
import type { Translations } from '../locales/en';
import { de } from '../locales/de';
import { STORAGE_KEYS } from '../config/storageKeys';

type Language = 'en' | 'de';

const translations: Record<Language, Translations> = {
  en,
  de,
};

/**
 * Get current language from localStorage
 */
export function getCurrentLanguage(): Language {
  const stored = localStorage.getItem(STORAGE_KEYS.LOCAL.LANGUAGE);
  if (stored === 'en' || stored === 'de') {
    return stored;
  }

  // Detect browser language
  const browserLang = navigator.language.split('-')[0];
  if (browserLang === 'de') {
    return 'de';
  }

  return 'en';
}

/**
 * Set current language
 */
export function setCurrentLanguage(lang: Language): void {
  localStorage.setItem(STORAGE_KEYS.LOCAL.LANGUAGE, lang);
}

/**
 * Get translations for current language
 */
export function getTranslations(): Translations {
  return translations[getCurrentLanguage()];
}

/**
 * Translate a key with optional interpolation
 * Usage: t('lobby.minPlayersRequired', { min: 2 })
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const trans = getTranslations();
  const keys = key.split('.');

  let value: unknown = trans;
  for (const k of keys) {
    if (typeof value === 'object' && value !== null && k in value) {
      value = (value as Record<string, unknown>)[k];
    } else {
      console.warn(`Translation key not found: ${key}`);
      return key;
    }
  }

  if (typeof value !== 'string') {
    console.warn(`Translation key is not a string: ${key}`);
    return key;
  }

  // Interpolate params
  if (params) {
    return value.replace(/\{(\w+)\}/g, (_, paramKey) => {
      return params[paramKey]?.toString() ?? `{${paramKey}}`;
    });
  }

  return value;
}
