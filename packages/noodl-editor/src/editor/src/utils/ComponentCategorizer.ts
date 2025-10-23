/**
 * Component Categorizer
 * Automatically assigns categories to discovered components based on name patterns
 */

import { DiscoveredComponent } from './ComponentScanner';

export interface CategorizedComponent {
  component: DiscoveredComponent;
  category: string;      // e.g., "UI/Overlays"
  subcategory: string;   // e.g., "Radix UI"
}

// Category mapping rules (order matters - first match wins)
const CATEGORY_RULES = [
  {
    category: 'UI/Inputs',
    keywords: ['button', 'link', 'input', 'checkbox', 'radio', 'select', 'textarea', 'switch',
               'toggle', 'slider', 'range', 'upload', 'file', 'picker', 'color', 'date', 'time']
  },
  {
    category: 'UI/Overlays',
    keywords: ['dialog', 'modal', 'popover', 'tooltip', 'dropdown', 'menu', 'sheet', 'drawer',
               'overlay', 'portal', 'popper']
  },
  {
    category: 'UI/Layout',
    keywords: ['card', 'panel', 'container', 'box', 'stack', 'grid', 'flex', 'layout', 'group',
               'section', 'divider', 'separator', 'spacer']
  },
  {
    category: 'UI/Typography',
    keywords: ['text', 'heading', 'title', 'paragraph', 'label', 'caption', 'code', 'blockquote']
  },
  {
    category: 'UI/Display',
    keywords: ['icon', 'avatar', 'badge', 'chip', 'tag', 'spinner', 'loader', 'skeleton',
               'image', 'video', 'progress', 'indicator']
  },
  {
    category: 'UI/Forms',
    keywords: ['form', 'field', 'control', 'validation', 'error', 'fieldset', 'legend']
  },
  {
    category: 'UI/Data Display',
    keywords: ['table', 'list', 'tree', 'data', 'row', 'cell', 'column', 'pagination', 'virtualized']
  },
  {
    category: 'UI/Navigation',
    keywords: ['tab', 'tabs', 'accordion', 'collapse', 'disclosure', 'nav', 'breadcrumb',
               'stepper', 'wizard']
  },
  {
    category: 'UI/Feedback',
    keywords: ['toast', 'alert', 'notification', 'snackbar', 'message', 'banner', 'callout',
               'feedback', 'status']
  }
];

// Special handling for icon packages
const ICON_PACKAGES = ['react-icons', 'lucide-react', '@heroicons/react', '@tabler/icons-react'];

/**
 * Categorize components based on name patterns
 *
 * @param components - Array of discovered components
 * @returns Array of categorized components
 */
export function categorizeComponents(components: DiscoveredComponent[]): CategorizedComponent[] {
  return components.map(component => {
    const category = determineCategory(component);
    const subcategory = determineSubcategory(component);

    return {
      component,
      category,
      subcategory
    };
  });
}

/**
 * Determine category for a component
 */
function determineCategory(component: DiscoveredComponent): string {
  // Special handling for icon packages
  if (isIconPackage(component.packageName)) {
    return 'UI/Display';
  }

  // Extract keywords from component name
  const keywords = extractKeywords(component.name);

  // Match against category rules
  for (const rule of CATEGORY_RULES) {
    if (matchesKeywords(keywords, rule.keywords)) {
      return rule.category;
    }
  }

  // Fallback category
  return `NPM Components/${formatPackageName(component.packageName)}`;
}

/**
 * Determine subcategory for a component
 */
function determineSubcategory(component: DiscoveredComponent): string {
  // Special handling for icon packages
  if (isIconPackage(component.packageName)) {
    return 'Icons';
  }

  // Use formatted package name as subcategory
  return formatPackageName(component.packageName);
}

/**
 * Check if package is an icon package
 */
function isIconPackage(packageName: string): boolean {
  return ICON_PACKAGES.some(iconPkg => packageName.includes(iconPkg));
}

/**
 * Extract keywords from component name by splitting on capital letters
 *
 * @example
 * extractKeywords('AlertDialog') => ['alert', 'dialog']
 * extractKeywords('FormControl') => ['form', 'control']
 */
function extractKeywords(componentName: string): string[] {
  // Split by capital letters
  const parts = componentName.split(/(?=[A-Z])/);

  // Convert to lowercase and filter empty strings
  return parts
    .map(part => part.toLowerCase())
    .filter(part => part.length > 0);
}

/**
 * Check if component keywords match category keywords
 */
function matchesKeywords(componentKeywords: string[], categoryKeywords: string[]): boolean {
  // Check if any component keyword matches any category keyword
  for (const compKeyword of componentKeywords) {
    for (const catKeyword of categoryKeywords) {
      if (compKeyword.includes(catKeyword) || catKeyword.includes(compKeyword)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Format package name for display
 *
 * @example
 * formatPackageName('@radix-ui/react-dialog') => 'Radix UI'
 * formatPackageName('react-bootstrap') => 'React Bootstrap'
 * formatPackageName('antd') => 'Antd'
 */
function formatPackageName(packageName: string): string {
  // Remove scope if present
  let name = packageName.startsWith('@')
    ? packageName.split('/')[0].substring(1)
    : packageName;

  // Handle common patterns
  if (name.includes('react-')) {
    name = name.replace('react-', '');
  }
  if (name.includes('-ui')) {
    name = name.replace('-ui', ' UI');
  }

  // Split by hyphens and capitalize
  const parts = name.split('-');
  const formatted = parts
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

  return formatted;
}
