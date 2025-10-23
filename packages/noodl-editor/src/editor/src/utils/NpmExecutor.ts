/**
 * NPM Executor
 * Executes npm install commands in project directory
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { ParsedPackage } from './NpmCommandParser';

export interface InstallResult {
  success: boolean;
  installedPackages: InstalledPackageInfo[];
  errors?: string[];
}

export interface InstalledPackageInfo {
  name: string;
  version: string;
  location: string;  // path in node_modules
}

/**
 * Execute npm install for given packages
 *
 * @param packages - Array of parsed packages to install
 * @param projectPath - Path to project directory
 * @param onProgress - Callback for progress updates
 * @returns Promise resolving to install result
 */
export async function executeNpmInstall(
  packages: ParsedPackage[],
  projectPath: string,
  onProgress: (message: string) => void
): Promise<InstallResult> {
  try {
    // Validate project path exists
    if (!fs.existsSync(projectPath)) {
      return {
        success: false,
        installedPackages: [],
        errors: [`Project directory does not exist: ${projectPath}`]
      };
    }

    // Check for package.json, create if missing
    const packageJsonPath = path.join(projectPath, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      onProgress('No package.json found, initializing project...');
      await initializeProject(projectPath, onProgress);
    }

    // Construct npm install command
    const installArgs = ['install'];

    // Add packages with versions
    for (const pkg of packages) {
      const packageSpec = pkg.version ? `${pkg.name}@${pkg.version}` : pkg.name;
      installArgs.push(packageSpec);
    }

    // Add --save or --save-dev flag
    const isDev = packages.some(pkg => pkg.isDev);
    if (isDev) {
      installArgs.push('--save-dev');
    } else {
      installArgs.push('--save');
    }

    onProgress(`Running: npm ${installArgs.join(' ')}`);

    // Execute npm install
    const result = await executeCommand('npm', installArgs, projectPath, onProgress);

    if (!result.success) {
      return {
        success: false,
        installedPackages: [],
        errors: result.errors
      };
    }

    // Get installed package information
    const installedPackages = await getInstalledPackageInfo(packages, projectPath);

    onProgress(`Successfully installed ${installedPackages.length} package(s)`);

    return {
      success: true,
      installedPackages,
      errors: []
    };

  } catch (error) {
    return {
      success: false,
      installedPackages: [],
      errors: [error instanceof Error ? error.message : String(error)]
    };
  }
}

/**
 * Initialize project with npm init -y
 */
async function initializeProject(projectPath: string, onProgress: (message: string) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const npmInit = spawn('npm', ['init', '-y'], {
      cwd: projectPath,
      shell: true
    });

    npmInit.on('close', (code) => {
      if (code === 0) {
        onProgress('Project initialized successfully');
        resolve();
      } else {
        reject(new Error('Failed to initialize project'));
      }
    });

    npmInit.on('error', (error) => {
      reject(new Error(`npm init failed: ${error.message}`));
    });
  });
}

/**
 * Execute command and stream output
 */
async function executeCommand(
  command: string,
  args: string[],
  cwd: string,
  onProgress: (message: string) => void
): Promise<{ success: boolean; errors?: string[] }> {
  return new Promise((resolve) => {
    const errors: string[] = [];
    let outputBuffer = '';

    const childProcess = spawn(command, args, {
      cwd,
      shell: true
    });

    // Set 5 minute timeout
    const timeout = setTimeout(() => {
      childProcess.kill();
      errors.push('Installation timed out after 5 minutes. Package may be too large or network is slow.');
      resolve({ success: false, errors });
    }, 5 * 60 * 1000);

    // Stream stdout
    childProcess.stdout.on('data', (data) => {
      const message = data.toString();
      outputBuffer += message;

      // Send meaningful lines to progress callback
      const lines = message.split('\n').filter((line: string) => line.trim());
      lines.forEach((line: string) => {
        if (line.trim()) {
          onProgress(line.trim());
        }
      });
    });

    // Stream stderr (npm warnings/errors)
    childProcess.stderr.on('data', (data) => {
      const message = data.toString();
      outputBuffer += message;

      // Parse npm error messages
      if (message.includes('ERR!') || message.includes('ERROR')) {
        errors.push(message.trim());
      }

      onProgress(message.trim());
    });

    // Handle completion
    childProcess.on('close', (code) => {
      clearTimeout(timeout);

      if (code === 0) {
        resolve({ success: true });
      } else {
        // Parse common npm errors for user-friendly messages
        const errorMessage = parseNpmErrors(outputBuffer, errors);
        resolve({ success: false, errors: errorMessage });
      }
    });

    // Handle process errors
    childProcess.on('error', (error) => {
      clearTimeout(timeout);

      if (error.message.includes('ENOENT')) {
        errors.push('npm command not found. Please ensure Node.js and npm are installed.');
      } else {
        errors.push(`Command execution failed: ${error.message}`);
      }

      resolve({ success: false, errors });
    });
  });
}

/**
 * Parse npm error output for user-friendly messages
 */
function parseNpmErrors(output: string, existingErrors: string[]): string[] {
  const errors = [...existingErrors];

  // Network errors
  if (output.includes('ENOTFOUND') || output.includes('getaddrinfo')) {
    errors.push('Unable to reach npm registry. Check your internet connection.');
  }

  // Permission errors
  if (output.includes('EACCES') || output.includes('permission denied')) {
    errors.push('Permission denied. Try running Noodl with elevated privileges or check folder permissions.');
  }

  // Package not found
  if (output.includes('E404') || output.includes('Not Found')) {
    const packageMatch = output.match(/'([^']+)' is not in the npm registry/);
    if (packageMatch) {
      errors.push(`Package '${packageMatch[1]}' not found on npm registry.`);
    } else {
      errors.push('Package not found on npm registry.');
    }
  }

  // Peer dependency warnings
  if (output.includes('ERESOLVE') || output.includes('peer dep')) {
    errors.push('Peer dependency conflict detected. Installation may have issues. Consider using --legacy-peer-deps flag.');
  }

  // If no specific errors parsed, return generic message
  if (errors.length === 0) {
    errors.push('npm install failed. Check console for details.');
  }

  return errors;
}

/**
 * Get information about installed packages
 */
async function getInstalledPackageInfo(
  packages: ParsedPackage[],
  projectPath: string
): Promise<InstalledPackageInfo[]> {
  const installedPackages: InstalledPackageInfo[] = [];
  const nodeModulesPath = path.join(projectPath, 'node_modules');

  for (const pkg of packages) {
    try {
      const packagePath = path.join(nodeModulesPath, pkg.name);
      const packageJsonPath = path.join(packagePath, 'package.json');

      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        installedPackages.push({
          name: pkg.name,
          version: packageJson.version || 'unknown',
          location: packagePath
        });
      }
    } catch (error) {
      // Package may not have been installed successfully, skip
      console.warn(`Could not read package info for ${pkg.name}:`, error);
    }
  }

  return installedPackages;
}
