import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { pt } from "./locales/pt";
import { en } from "./locales/en";
import { installAutoTranslator } from "./auto-translate";

const STORAGE_KEY = "app_language";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      "pt-br": { translation: pt },
      pt: { translation: pt },
      en: { translation: en },
    },
    fallbackLng: "pt-br",
    supportedLngs: ["pt-br", "pt", "en"],
    nonExplicitSupportedLngs: true,
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: STORAGE_KEY,
      caches: ["localStorage"],
    },
    returnNull: false,
    // If a key is missing, render the key itself (which is the Portuguese label).
    parseMissingKeyHandler: (key) => key,
  });

export function setAppLanguage(lng: string) {
  const normalized = lng === "pt-br" || lng === "pt" ? "pt-br" : lng;
  try {
    localStorage.setItem(STORAGE_KEY, normalized);
  } catch {
    /* ignore */
  }
  i18n.changeLanguage(normalized);
  document.documentElement.lang = normalized === "en" ? "en" : "pt-BR";
}

// Activate the runtime DOM auto-translator (covers strings not yet wrapped with t()).
installAutoTranslator();

export default i18n;