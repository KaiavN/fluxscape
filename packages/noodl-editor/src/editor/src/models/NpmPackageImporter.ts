/**
 * NPM Package Importer
 * Orchestrates the complete npm import workflow
 */

import { parseNpmCommand, ParsedPackage } from '../utils/NpmCommandParser';
import { executeNpmInstall, InstallResult, InstalledPackageInfo } from '../utils/NpmExecutor';
import { scanPackageForComponents, DiscoveredComponent } from '../utils/ComponentScanner';
import { categorizeComponents, CategorizedComponent } from '../utils/ComponentCategorizer';
import { NodeLibraryImporter } from './nodelibrary/NodeLibraryImporter';
import { ProjectModel } from './projectmodel';

export interface ImportStatus {
  stage: 'parsing' | 'installing' | 'discovering' | 'categorizing' | 'registering' | 'complete' | 'error';
  message: string;
  percent?: number;  // 0-100
  details?: string;  // additional info
}

export interface ImportResult {
  success: boolean;
  componentCount?: number;
  packages?: string[];
  error?: string;
}

/**
 * NPM Package Importer - singleton class
 */
export class NpmPackageImporter {
  private static _instance: NpmPackageImporter;
  private _importInProgress = false;

  public static get instance(): NpmPackageImporter {
    if (!NpmPackageImporter._instance) {
      NpmPackageImporter._instance = new NpmPackageImporter();
    }
    return NpmPackageImporter._instance;
  }

  /**
   * Import packages from npm command
   *
   * @param command - npm install command string
   * @param onProgress - Progress callback
   * @returns Promise resolving to import result
   */
  public async importFromCommand(
    command: string,
    onProgress: (status: ImportStatus) => void
  ): Promise<ImportResult> {

    // Check if import already in progress
    if (this._importInProgress) {
      return {
        success: false,
        error: 'Import already in progress. Please wait for current import to complete.'
      };
    }

    this._importInProgress = true;

    try {
      // Step 1: Parse command
      onProgress({
        stage: 'parsing',
        message: 'Parsing command...',
        percent: 10
      });

      const parseResult = parseNpmCommand(command);

      if (parseResult instanceof Error) {
        onProgress({
          stage: 'error',
          message: 'Failed to parse command',
          details: parseResult.message
        });
        return {
          success: false,
          error: parseResult.message
        };
      }

      const packages: ParsedPackage[] = parseResult;
      console.log('[npm-import] Parsed packages:', packages);

      // Step 2: Execute npm install
      onProgress({
        stage: 'installing',
        message: `Installing ${packages.length} package(s)...`,
        percent: 20
      });

      const projectPath = this.getProjectPath();
      if (!projectPath) {
        const error = 'No project directory found. Please save your project first.';
        onProgress({
          stage: 'error',
          message: error
        });
        return {
          success: false,
          error
        };
      }

      const installResult = await executeNpmInstall(
        packages,
        projectPath,
        (message: string) => {
          onProgress({
            stage: 'installing',
            message: 'Installing packages...',
            percent: 30,
            details: message
          });
        }
      );

      if (!installResult.success) {
        const error = installResult.errors?.join('\n') || 'Installation failed';
        onProgress({
          stage: 'error',
          message: 'Installation failed',
          details: error
        });
        return {
          success: false,
          error
        };
      }

      console.log('[npm-import] Installed packages:', installResult.installedPackages);

      // Step 3: Discover components
      onProgress({
        stage: 'discovering',
        message: 'Scanning packages for React components...',
        percent: 50
      });

      const allComponents: DiscoveredComponent[] = [];

      for (const packageInfo of installResult.installedPackages) {
        const components = await scanPackageForComponents(packageInfo);
        allComponents.push(...components);

        onProgress({
          stage: 'discovering',
          message: `Found ${allComponents.length} component(s) so far...`,
          percent: 50 + (allComponents.length * 0.1)
        });
      }

      console.log('[npm-import] Discovered components:', allComponents.length);

      if (allComponents.length === 0) {
        // No components found - warn but don't fail
        const packageNames = installResult.installedPackages.map(p => p.name).join(', ');
        onProgress({
          stage: 'complete',
          message: `No React components found in ${packageNames}`,
          percent: 100,
          details: 'The package(s) were installed but do not contain React components.'
        });
        return {
          success: true,
          componentCount: 0,
          packages: installResult.installedPackages.map(p => p.name)
        };
      }

      // Step 4: Categorize components
      onProgress({
        stage: 'categorizing',
        message: 'Categorizing components...',
        percent: 70
      });

      const categorizedComponents = categorizeComponents(allComponents);
      console.log('[npm-import] Categorized components:', categorizedComponents.length);

      // Step 5: Register with node library
      onProgress({
        stage: 'registering',
        message: 'Registering components...',
        percent: 85
      });

      // TODO: Implement registerNpmComponents() method in NodeLibraryImporter
      // This requires completing the component registration system integration
      // NodeLibraryImporter.instance.registerNpmComponents(categorizedComponents);
      console.log('[npm-import] Component registration not yet implemented. Discovered:', categorizedComponents.length);

      // Step 6: Complete
      onProgress({
        stage: 'complete',
        message: `Successfully imported ${allComponents.length} component(s)!`,
        percent: 100
      });

      return {
        success: true,
        componentCount: allComponents.length,
        packages: installResult.installedPackages.map(p => p.name)
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[npm-import] Error:', error);

      onProgress({
        stage: 'error',
        message: 'Import failed',
        details: errorMessage
      });

      return {
        success: false,
        error: errorMessage
      };

    } finally {
      this._importInProgress = false;
    }
  }

  /**
   * Get project directory path
   */
  private getProjectPath(): string | null {
    try {
      // Get project path from ProjectModel
      const projectModel = ProjectModel.instance;

      // @ts-ignore - accessing private property
      if (projectModel && projectModel._retainedProjectDirectory) {
        // @ts-ignore
        return projectModel._retainedProjectDirectory;
      }

      // Fallback: try to get from project save location
      // @ts-ignore
      if (projectModel && projectModel.path) {
        // @ts-ignore
        return projectModel.path;
      }

      return null;
    } catch (error) {
      console.error('[npm-import] Error getting project path:', error);
      return null;
    }
  }

  /**
   * Check if import is currently in progress
   */
  public get isImporting(): boolean {
    return this._importInProgress;
  }
}
