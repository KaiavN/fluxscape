// import Store from 'electron-store';

import { EditorSettings } from '@noodl-utils/editorsettings';

// import { decryptString, encryptString } from './_internal/StorageApi';

// const store = new Store<Record<string, string>>({
//   name: 'AiAssistant',
//   encryptionKey: 'b4a5d3b3-5e3e-477e-a978-9d347bc8b834',
//   defaults: {
//     defaultModel: 'gpt-4'
//   }
// });

const AI_ASSISTANT_API_KEY = 'aiAssistant.temporaryApiKey';
const AI_ASSISTANT_VERSION_KEY = 'aiAssistant.version';
const AI_ASSISTANT_VERIFIED_KEY = 'aiAssistant.verified';
const AI_ASSISTANT_ENDPOINT_KEY = 'aiAssistant.endpoint';
const AI_ASSISTANT_MODEL_KEY = 'aiAssistant.model';
const AI_ASSISTANT_IMAGE_MODEL_KEY = 'aiAssistant.imageModel';

export type AiVersion = 'disabled' | 'openrouter';

export type AiModel = string;

export const OpenAiStore = {
  isEnabled(): boolean {
    const version = EditorSettings.instance.get(AI_ASSISTANT_VERSION_KEY);
    return version === 'openrouter';
  },
  getVersion(): AiVersion {
    const stored = EditorSettings.instance.get(AI_ASSISTANT_VERSION_KEY);
    // Migrate old versions to openrouter
    if (stored === 'full-beta' || stored === 'enterprise') {
      return 'openrouter';
    }
    return stored || 'openrouter';
  },
  getPrettyVersion(): string {
    switch (this.getVersion()) {
      case 'openrouter':
        return 'OpenRouter';
      case 'disabled':
        return 'Disabled';
    }
    return null;
  },
  setVersion(value: AiVersion): void {
    EditorSettings.instance.set(AI_ASSISTANT_VERSION_KEY, value);
  },

  getApiKey() {
    return EditorSettings.instance.get(AI_ASSISTANT_API_KEY);
  },
  async setApiKey(value: string) {
    EditorSettings.instance.set(AI_ASSISTANT_API_KEY, value);
  },
  setModel(value: string) {
    EditorSettings.instance.set(AI_ASSISTANT_MODEL_KEY, value);
  },
  getModel(): AiModel {
    const stored = EditorSettings.instance.get(AI_ASSISTANT_MODEL_KEY);
    
    // Migrate old format to OpenRouter format
    if (stored === 'gpt-3') return 'openai/gpt-3.5-turbo';
    if (stored === 'gpt-4') return 'openai/gpt-4';
    
    return stored || 'openai/gpt-4';
  },
  setImageModel(value: string): void {
    EditorSettings.instance.set(AI_ASSISTANT_IMAGE_MODEL_KEY, value);
  },
  getImageModel(): string {
    const stored = EditorSettings.instance.get(AI_ASSISTANT_IMAGE_MODEL_KEY);
    return stored || 'black-forest-labs/flux-schnell-free';
  }
};
