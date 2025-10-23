import { AiModel, AiVersion, OpenAiStore } from '@noodl-store/AiAssistantStore';
import React, { useState } from 'react';
import { platform } from '@noodl/platform';

import { PrimaryButton, PrimaryButtonSize, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { Box } from '@noodl-core-ui/components/layout/Box';
import { VStack } from '@noodl-core-ui/components/layout/Stack';
import { PropertyPanelRow } from '@noodl-core-ui/components/property-panel/PropertyPanelInput';
import { PropertyPanelPasswordInput } from '@noodl-core-ui/components/property-panel/PropertyPanelPasswordInput';
import { PropertyPanelSelectInput } from '@noodl-core-ui/components/property-panel/PropertyPanelSelectInput';
import { PropertyPanelTextInput } from '@noodl-core-ui/components/property-panel/PropertyPanelTextInput';
import { CollapsableSection } from '@noodl-core-ui/components/sidebar/CollapsableSection';
import { Text } from '@noodl-core-ui/components/typography/Text';
import { Title, TitleSize } from '@noodl-core-ui/components/typography/Title';

export const AI_ASSISTANT_ENABLED_SUGGESTIONS_KEY = 'aiAssistant.enabledSuggestions';

export function OpenAiSection() {
  const [enabledState, setEnabledState] = useState<AiVersion>(OpenAiStore.getVersion());
  const [apiKey, setApiKey] = useState(OpenAiStore.getApiKey());
  const [model, setModel] = useState<AiModel>(OpenAiStore.getModel());

  return (
    <CollapsableSection title="FluxScape AI (Beta)">
      <Box hasXSpacing>
        <VStack>
          <PropertyPanelRow label="Version" isChanged={false}>
            <PropertyPanelSelectInput
              value={enabledState}
              properties={{
                options: [
                  { label: 'Disabled', value: 'disabled' },
                  { label: 'OpenRouter', value: 'openrouter' }
                ]
              }}
              onChange={(value: AiVersion) => {
                setEnabledState(value);
                OpenAiStore.setVersion(value);
              }}
            />
          </PropertyPanelRow>

          {enabledState === 'disabled' && (
            <Box hasYSpacing>
              <Text>FluxScape AI is currently disabled.</Text>
            </Box>
          )}

          {enabledState === 'openrouter' && (
            <>
              <PropertyPanelRow label="Model ID" isChanged={false}>
                <PropertyPanelTextInput
                  value={model}
                  placeholder="openai/gpt-4"
                  onChange={(value: string) => {
                    setModel(value);
                    OpenAiStore.setModel(value);
                  }}
                />
              </PropertyPanelRow>
              <Box hasYSpacing>
                <Text>Enter any OpenRouter model ID (see openrouter.ai/models)</Text>
              </Box>
              <PropertyPanelRow label="API Key" isChanged={false}>
                <PropertyPanelPasswordInput
                  value={apiKey}
                  onChange={(value) => {
                    setApiKey(value);
                    OpenAiStore.setApiKey(value);
                  }}
                />
              </PropertyPanelRow>
              <Box hasYSpacing>
                <Text>Get your OpenRouter API key at openrouter.ai</Text>
              </Box>
            </>
          )}

          <Box
            hasXSpacing={3}
            hasYSpacing={3}
            UNSAFE_style={{ borderRadius: '2px', background: 'var(--theme-color-bg-3)' }}
          >
            <Title size={TitleSize.Medium} hasBottomSpacing>
              FluxScape AI docs
            </Title>
            <Text hasBottomSpacing>See setup instructions and guides for how to use FluxScape AI on our docs.</Text>
            <PrimaryButton
              variant={PrimaryButtonVariant.Muted}
              size={PrimaryButtonSize.Small}
              isGrowing
              label="Open docs"
              onClick={() => {
                platform.openExternal('https://docs.fluxscape.io/docs/getting-started/noodl-ai');
              }}
            />
          </Box>
        </VStack>
      </Box>
    </CollapsableSection>
  );
}
