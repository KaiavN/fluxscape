/**
 * NPM Command Parser
 * Parses npm/yarn/pnpm install commands to extract package information
 */

export interface ParsedPackage {
  name: string;           // e.g., "@radix-ui/react-dialog"
  version?: string;       // e.g., "1.2.3" or undefined for latest
  isDev: boolean;         // true if --save-dev or -D flag present
}

/**
 * Parse npm install command and extract package details
 *
 * @param command - The npm/yarn/pnpm install command string
 * @returns Array of parsed packages or Error if invalid command
 *
 * @example
 * parseNpmCommand('npm install lodash')
 * // Returns: [{name: 'lodash', isDev: false}]
 *
 * @example
 * parseNpmCommand('npm i @radix-ui/react-dialog@1.0.0 react-icons')
 * // Returns: [{name: '@radix-ui/react-dialog', version: '1.0.0', isDev: false}, {name: 'react-icons', isDev: false}]
 */
export function parseNpmCommand(command: string): ParsedPackage[] | Error {
  // Trim whitespace
  const trimmedCommand = command.trim();

  if (!trimmedCommand) {
    return new Error('Command cannot be empty');
  }

  // Split by spaces
  const parts = trimmedCommand.split(/\s+/);

  // Identify package manager and command
  const packageManager = parts[0];
  const installCommand = parts[1];

  // Validate package manager
  if (!['npm', 'yarn', 'pnpm'].includes(packageManager)) {
    return new Error(`Unsupported package manager: ${packageManager}. Use npm, yarn, or pnpm.`);
  }

  // Validate install command
  const validInstallCommands = ['install', 'i', 'add'];
  if (!validInstallCommands.includes(installCommand)) {
    return new Error(`Invalid command: ${installCommand}. Use install, i, or add.`);
  }

  // Check for global install flag
  if (parts.includes('-g') || parts.includes('--global')) {
    return new Error('Global installs (-g, --global) are not supported. Only local project installs are allowed.');
  }

  // Check for dev dependency flags
  const isDev = parts.includes('--save-dev') || parts.includes('-D');

  // Extract packages (skip flags and package manager/command)
  const packages: ParsedPackage[] = [];
  const flags = new Set(['--save-dev', '-D', '--save', '-S', '--force', '--legacy-peer-deps', '-E', '--save-exact', '-P', '--save-prod']);

  for (let i = 2; i < parts.length; i++) {
    const part = parts[i];

    // Skip flags
    if (part.startsWith('--') || (part.startsWith('-') && part.length === 2)) {
      if (flags.has(part)) {
        continue;
      }
      // Unknown flag - preserve but skip
      continue;
    }

    // Parse package name and version
    let packageName: string;
    let version: string | undefined;

    // Handle scoped packages with version: @org/package@1.0.0
    if (part.startsWith('@')) {
      // Find the last @ which indicates version
      const lastAtIndex = part.lastIndexOf('@');
      if (lastAtIndex > 0) {
        // Has version
        packageName = part.substring(0, lastAtIndex);
        version = part.substring(lastAtIndex + 1);
      } else {
        // No version
        packageName = part;
      }
    } else {
      // Regular package
      const atIndex = part.indexOf('@');
      if (atIndex > 0) {
        // Has version
        packageName = part.substring(0, atIndex);
        version = part.substring(atIndex + 1);
      } else {
        // No version
        packageName = part;
      }
    }

    // Validate package name
    if (packageName.length === 0) {
      continue;
    }

    packages.push({
      name: packageName,
      version,
      isDev
    });
  }

  // Validate at least one package found
  if (packages.length === 0) {
    return new Error('No packages found in command. Please specify at least one package to install.');
  }

  return packages;
}
