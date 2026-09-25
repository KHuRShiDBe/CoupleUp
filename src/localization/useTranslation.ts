import { useAppStore } from '../store/AppContext';
import { translations, Language, TranslationDictionary } from './index';

type Namespace = keyof TranslationDictionary;
type KeyOf<N extends Namespace> = string & keyof TranslationDictionary[N];
export type TranslationKey = { [N in Namespace]: `${N}.${KeyOf<N>}` }[Namespace];

const interpolate = (raw: string, params?: Record<string, string | number>): string => {
  if (!params) return raw;
  return Object.keys(params).reduce((acc, key) => acc.split(`{${key}}`).join(String(params[key])), raw);
};

export const useTranslation = () => {
  const { language, actions } = useAppStore();
  const dict = translations[language];

  const t = (key: TranslationKey, params?: Record<string, string | number>): string => {
    const [ns, k] = key.split('.') as [Namespace, string];
    const namespace = dict[ns] as Record<string, string> | undefined;
    const fallbackNamespace = translations.ru[ns] as Record<string, string>;
    const raw = namespace?.[k] ?? fallbackNamespace[k] ?? key;
    return interpolate(raw, params);
  };

  return { t, language, setLanguage: actions.setLanguage as (language: Language) => void };
};
