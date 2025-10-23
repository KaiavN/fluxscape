/**
 * NPM Import Panel
 * UI for importing npm packages and discovering their React components
 */

import React, { useState } from 'react';

import { PrimaryButton, PrimaryButtonSize, PrimaryButtonVariant } from '@noodl-core-ui/components/inputs/PrimaryButton';
import { TextArea } from '@noodl-core-ui/components/inputs/TextArea';
import { Box } from '@noodl-core-ui/components/layout/Box';
import { VStack } from '@noodl-core-ui/components/layout/Stack';
import { BasePanel } from '@noodl-core-ui/components/sidebar/BasePanel';
import { Text, TextSize, TextType } from '@noodl-core-ui/components/typography/Text';
import { FeedbackType } from '@noodl-constants/FeedbackType';

import { NpmPackageImporter, ImportStatus } from '../../../models/NpmPackageImporter';
import { ToastLayer } from '../../ToastLayer/ToastLayer';
import { ToastType } from '../../ToastLayer/components/ToastCard/ToastCard';

type InstallationStatus = 'idle' | 'validating' | 'installing' | 'discovering' | 'categorizing' | 'complete' | 'error';

interface InstalledPackage {
  name: string;
  version: string;
  componentCount: number;
}

export function NpmImportPanel() {
  const [command, setCommand] = useState('');
  const [status, setStatus] = useState<InstallationStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [statusDetails, setStatusDetails] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [installedPackages, setInstalledPackages] = useState<InstalledPackage[]>([]);
  const [progress, setProgress] = useState(0);

  const handleCommandChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCommand(e.target.value);
    setErrorMessage('');
  };

  const validateCommand = (cmd: string): boolean => {
    const trimmed = cmd.trim();
    if (!trimmed) {
      setErrorMessage('Please enter a command');
      return false;
    }

    const validStarts = ['npm install', 'npm i', 'yarn add', 'pnpm add'];
    const isValid = validStarts.some(start => trimmed.startsWith(start));

    if (!isValid) {
      setErrorMessage('Please enter a valid npm install command');
      return false;
    }

    return true;
  };

  const handleInstall = async () => {
    if (!validateCommand(command)) {
      return;
    }

    // Reset state
    setErrorMessage('');
    setStatusDetails('');
    setStatus('validating');
    setStatusMessage('Validating command...');
    setProgress(0);

    try {
      const result = await NpmPackageImporter.instance.importFromCommand(
        command,
        (importStatus: ImportStatus) => {
          // Update UI based on import status
          setStatus(importStatus.stage as InstallationStatus);
          setStatusMessage(importStatus.message);
          setStatusDetails(importStatus.details || '');
          setProgress(importStatus.percent || 0);
        }
      );

      if (result.success) {
        // Show success toast
        ToastLayer.showSuccess(
          `Successfully imported ${result.componentCount} component(s) from ${result.packages?.join(', ')}`,
        );

        // Update installed packages list
        if (result.componentCount && result.componentCount > 0) {
          const newPackages: InstalledPackage[] = (result.packages || []).map(name => ({
            name,
            version: 'latest',
            componentCount: result.componentCount || 0
          }));
          setInstalledPackages(prev => [...prev, ...newPackages]);
        }

        // Clear command after success
        setCommand('');
      } else {
        // Show error
        setErrorMessage(result.error || 'Installation failed');
        ToastLayer.showError(
          `Failed to install package: ${result.error}`,
        );
      }

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      setErrorMessage(message);
      setStatus('error');
      ToastLayer.showError(`Installation error: ${message}`);
    }
  };

  const isInstalling = ['validating', 'installing', 'discovering', 'categorizing'].includes(status);

  return (
    <BasePanel title="NPM Packages" hasContentScroll>
      <Box hasXSpacing hasTopSpacing={2} hasBottomSpacing={2}>
        <VStack hasSpacing>
          {/* Instructions */}
          <Box>
            <Text size={TextSize.Medium}>
              Paste an npm install command to automatically import React components from packages.
            </Text>
          </Box>

          {/* Command input */}
          <Box>
            <TextArea
              value={command}
              onChange={handleCommandChange}
              placeholder="npm install @radix-ui/react-dialog&#10;npm i react-icons&#10;yarn add antd"
              isDisabled={isInstalling}
              UNSAFE_style={{
                fontFamily: 'monospace',
                fontSize: '13px'
              }}
            />
          </Box>

          {/* Error message */}
          {errorMessage && (
            <Box>
              <Text size={TextSize.Medium} textType={FeedbackType.Danger}>
                {errorMessage}
              </Text>
            </Box>
          )}

          {/* Install button */}
          <Box>
            <PrimaryButton
              label={isInstalling ? 'Installing...' : 'Install & Discover Components'}
              variant={PrimaryButtonVariant.Cta}
              size={PrimaryButtonSize.Default}
              onClick={handleInstall}
              isDisabled={isInstalling || !command.trim()}
            />
          </Box>

          {/* Status display */}
          {isInstalling && (
            <Box hasTopSpacing={2}>
              <VStack hasSpacing>
                <Text size={TextSize.Medium} textType={TextType.Proud}>
                  {statusMessage}
                </Text>
                {statusDetails && (
                  <Text size={TextSize.Small} style={{ opacity: 0.7, fontFamily: 'monospace' }}>
                    {statusDetails}
                  </Text>
                )}
                {/* Progress bar */}
                <Box style={{
                  width: '100%',
                  height: '4px',
                  backgroundColor: 'var(--color-background-tertiary)',
                  borderRadius: '2px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${progress}%`,
                    height: '100%',
                    backgroundColor: 'var(--color-primary)',
                    transition: 'width 0.3s ease'
                  }} />
                </Box>
              </VStack>
            </Box>
          )}

          {/* Success message */}
          {status === 'complete' && (
            <Box hasTopSpacing={2}>
              <Text size={TextSize.Medium} textType={FeedbackType.Success}>
                ✓ {statusMessage}
              </Text>
            </Box>
          )}

          {/* Installed packages list */}
          {installedPackages.length > 0 && (
            <Box hasTopSpacing={4}>
              <VStack hasSpacing>
                <Text size={TextSize.Default} textType={TextType.Proud}>
                  Installed Packages
                </Text>
                {installedPackages.map((pkg, index) => (
                  <Box key={index} style={{
                    padding: '8px',
                    backgroundColor: 'var(--color-background-secondary)',
                    borderRadius: '4px'
                  }}>
                    <VStack hasSpacing={0.5}>
                      <Text size={TextSize.Default}>{pkg.name}</Text>
                      <Text size={TextSize.Small} style={{ opacity: 0.7 }}>
                        {pkg.componentCount} component(s)
                      </Text>
                    </VStack>
                  </Box>
                ))}
              </VStack>
            </Box>
          )}
        </VStack>
      </Box>
    </BasePanel>
  );
}
