/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OPENAI_COMPAT_API_ENDPOINT?: string;
  readonly VITE_OPENAI_COMPAT_MODELS_ENDPOINT?: string;
  readonly VITE_OPENAI_COMPAT_API_KEY?: string;
  readonly VITE_OPENAI_COMPAT_MODEL_H1?: string;
  readonly VITE_OPENAI_COMPAT_MODEL_H2?: string;
  readonly VITE_OPENAI_COMPAT_MODEL_TAIDE?: string;
  readonly VITE_OPENAI_COMPAT_TEMPERATURE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
