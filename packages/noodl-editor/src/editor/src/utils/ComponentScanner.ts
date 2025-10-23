/**
 * Component Scanner
 * Discovers React components in installed npm packages
 */

import * as fs from 'fs';
import * as path from 'path';
import { InstalledPackageInfo } from './NpmExecutor';

export interface DiscoveredComponent {
  name: string;                    // e.g., "Dialog"
  packageName: string;             // e.g., "@radix-ui/react-dialog"
  packageVersion: string;          // e.g., "1.0.0"
  exportPath: string;              // e.g., "@radix-ui/react-dialog/Dialog"
  exportType: 'named' | 'default'; // how it's exported
  filePath: string;                // path in node_modules for reference
}

// Safety limits
const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB
const MAX_FILES_TO_SCAN = 10000;

// File extensions to scan
const COMPONENT_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx'];

// Directories to exclude
const EXCLUDED_DIRS = ['__tests__', '__mocks__', 'test', 'tests', 'node_modules', '.git'];

// Files to exclude
const EXCLUDED_FILE_PATTERNS = ['.test.', '.spec.', '.d.ts', '.min.'];

/**
 * Scan package for React components
 *
 * @param packageInfo - Information about installed package
 * @returns Promise resolving to array of discovered components
 */
export async function scanPackageForComponents(
  packageInfo: InstalledPackageInfo
): Promise<DiscoveredComponent[]> {
  const components: DiscoveredComponent[] = [];

  try {
    // Read package.json to find entry points
    const packageJsonPath = path.join(packageInfo.location, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

    // Determine directories to scan
    const dirsToScan = getDirectoriesToScan(packageInfo.location, packageJson);

    // Scan files for components
    let filesScanned = 0;
    for (const dir of dirsToScan) {
      if (filesScanned >= MAX_FILES_TO_SCAN) {
        console.warn(`Reached max file scan limit for ${packageInfo.name}`);
        break;
      }

      const dirComponents = await scanDirectory(
        dir,
        packageInfo,
        MAX_FILES_TO_SCAN - filesScanned
      );

      components.push(...dirComponents);
      filesScanned += dirComponents.length;
    }

    // Remove duplicates (same component name from different files)
    const uniqueComponents = deduplicateComponents(components);

    return uniqueComponents;

  } catch (error) {
    console.error(`Error scanning package ${packageInfo.name}:`, error);
    return [];
  }
}

/**
 * Determine directories to scan based on package.json
 */
function getDirectoriesToScan(packageLocation: string, packageJson: any): string[] {
  const dirs: string[] = [];

  // Check exports field (modern packages)
  if (packageJson.exports) {
    const exportPaths = extractExportPaths(packageJson.exports);
    exportPaths.forEach(exportPath => {
      const fullPath = path.join(packageLocation, exportPath);
      if (fs.existsSync(fullPath)) {
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          dirs.push(fullPath);
        } else {
          // Add parent directory
          dirs.push(path.dirname(fullPath));
        }
      }
    });
  }

  // Check main and module fields
  ['main', 'module'].forEach(field => {
    if (packageJson[field]) {
      const mainPath = path.join(packageLocation, packageJson[field]);
      if (fs.existsSync(mainPath)) {
        dirs.push(path.dirname(mainPath));
      }
    }
  });

  // Scan common directories
  const commonDirs = ['src', 'lib', 'dist', 'components', 'esm', 'cjs'];
  commonDirs.forEach(dir => {
    const dirPath = path.join(packageLocation, dir);
    if (fs.existsSync(dirPath)) {
      dirs.push(dirPath);
    }
  });

  // If no directories found, scan root
  if (dirs.length === 0) {
    dirs.push(packageLocation);
  }

  // Remove duplicates
  return Array.from(new Set(dirs));
}

/**
 * Extract paths from exports field
 */
function extractExportPaths(exports: any): string[] {
  const paths: string[] = [];

  if (typeof exports === 'string') {
    paths.push(exports);
  } else if (typeof exports === 'object') {
    Object.values(exports).forEach((value: any) => {
      if (typeof value === 'string') {
        paths.push(value);
      } else if (typeof value === 'object') {
        paths.push(...extractExportPaths(value));
      }
    });
  }

  return paths;
}

/**
 * Recursively scan directory for components
 */
async function scanDirectory(
  dirPath: string,
  packageInfo: InstalledPackageInfo,
  maxFiles: number
): Promise<DiscoveredComponent[]> {
  const components: DiscoveredComponent[] = [];

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (components.length >= maxFiles) {
        break;
      }

      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        // Skip excluded directories
        if (EXCLUDED_DIRS.includes(entry.name)) {
          continue;
        }

        // Recursively scan subdirectory
        const subComponents = await scanDirectory(fullPath, packageInfo, maxFiles - components.length);
        components.push(...subComponents);

      } else if (entry.isFile()) {
        // Check if file should be scanned
        if (!shouldScanFile(entry.name)) {
          continue;
        }

        // Check file size
        const stats = fs.statSync(fullPath);
        if (stats.size > MAX_FILE_SIZE) {
          continue;
        }

        // Scan file for components
        const fileComponents = await scanFile(fullPath, packageInfo);
        components.push(...fileComponents);
      }
    }

  } catch (error) {
    console.warn(`Error scanning directory ${dirPath}:`, error);
  }

  return components;
}

/**
 * Check if file should be scanned
 */
function shouldScanFile(filename: string): boolean {
  // Check extension
  const ext = path.extname(filename);
  if (!COMPONENT_EXTENSIONS.includes(ext)) {
    return false;
  }

  // Check excluded patterns
  for (const pattern of EXCLUDED_FILE_PATTERNS) {
    if (filename.includes(pattern)) {
      return false;
    }
  }

  return true;
}

/**
 * Scan file for React components
 */
async function scanFile(
  filePath: string,
  packageInfo: InstalledPackageInfo
): Promise<DiscoveredComponent[]> {
  const components: DiscoveredComponent[] = [];

  try {
    const content = fs.readFileSync(filePath, 'utf-8');

    // Quick check: does file import/use React?
    if (!content.includes('React') && !content.includes('jsx') && !content.includes('tsx')) {
      return [];
    }

    // Regex patterns for React components
    const patterns = [
      // export function ComponentName
      /export\s+function\s+([A-Z][a-zA-Z0-9]*)/g,
      // export const ComponentName = () =>
      /export\s+const\s+([A-Z][a-zA-Z0-9]*)\s*=\s*(?:\(|React\.memo|forwardRef)/g,
      // export class ComponentName extends
      /export\s+class\s+([A-Z][a-zA-Z0-9]*)\s+extends\s+(?:React\.)?Component/g,
      // export default function ComponentName
      /export\s+default\s+function\s+([A-Z][a-zA-Z0-9]*)/g,
      // export default ComponentName (class or const)
      /export\s+default\s+([A-Z][a-zA-Z0-9]*)/g
    ];

    const foundComponents = new Set<string>();

    // Apply patterns
    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const componentName = match[1];
        if (componentName && isPascalCase(componentName)) {
          foundComponents.add(componentName);
        }
      }
    });

    // Check for named exports in export { } syntax
    const exportBlockPattern = /export\s*\{([^}]+)\}/g;
    let exportMatch;
    while ((exportMatch = exportBlockPattern.exec(content)) !== null) {
      const exports = exportMatch[1].split(',');
      exports.forEach(exp => {
        const name = exp.trim().split(/\s+as\s+/)[0].trim();
        if (isPascalCase(name)) {
          foundComponents.add(name);
        }
      });
    }

    // Create DiscoveredComponent objects
    foundComponents.forEach(componentName => {
      // Determine export type
      const isDefaultExport = content.includes(`export default ${componentName}`) ||
                              content.includes(`export default function ${componentName}`);

      // Create export path
      const relativePath = path.relative(packageInfo.location, filePath);
      const exportPath = `${packageInfo.name}/${relativePath.replace(/\\/g, '/')}`;

      components.push({
        name: componentName,
        packageName: packageInfo.name,
        packageVersion: packageInfo.version,
        exportPath,
        exportType: isDefaultExport ? 'default' : 'named',
        filePath
      });
    });

  } catch (error) {
    // File read error, skip
    console.warn(`Error scanning file ${filePath}:`, error);
  }

  return components;
}

/**
 * Check if string is PascalCase
 */
function isPascalCase(str: string): boolean {
  if (!str || str.length === 0) {
    return false;
  }
  return /^[A-Z][a-zA-Z0-9]*$/.test(str);
}

/**
 * Remove duplicate components (prefer named exports)
 */
function deduplicateComponents(components: DiscoveredComponent[]): DiscoveredComponent[] {
  const componentMap = new Map<string, DiscoveredComponent>();

  components.forEach(component => {
    const key = `${component.packageName}:${component.name}`;

    if (!componentMap.has(key)) {
      componentMap.set(key, component);
    } else {
      // Prefer named exports over default exports
      const existing = componentMap.get(key)!;
      if (component.exportType === 'named' && existing.exportType === 'default') {
        componentMap.set(key, component);
      }
    }
  });

  return Array.from(componentMap.values());
}
