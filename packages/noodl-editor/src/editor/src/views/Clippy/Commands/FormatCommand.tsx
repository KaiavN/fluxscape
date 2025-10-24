import { NodeGraphContextTmp } from '@noodl-contexts/NodeGraphContext/NodeGraphContext';
import { OpenAiStore } from '@noodl-store/AiAssistantStore';

import { AiCopilotContext } from '@noodl-models/AiAssistant/AiCopilotContext';
import { NodeGraphModel, NodeGraphNode } from '@noodl-models/nodegraphmodel';
import { ProjectModel } from '@noodl-models/projectmodel';
import { StylesModel } from '@noodl-models/StylesModel';
import { UndoActionGroup, UndoQueue } from '@noodl-models/undo-queue-model';

import { NodeGraphEditor } from '../../nodegrapheditor';

type FormatCommandOptions = {
  nodeGraph: NodeGraphEditor;
};

type SerializedNode = {
  id: string;
  type: string;
  label?: string;
  parameters: Record<string, any>;
  x: number;
  y: number;
  children: SerializedNode[];
};

type DesignTokens = {
  colors: string[];
  textStyles: any[];
};

export async function handleFormatCommand(
  prompt: string,
  statusCallback: (status: string) => void,
  options: FormatCommandOptions
) {
  try {
    // Check prerequisites
    const model = OpenAiStore.getModel();
    if (!model) {
      statusCallback('Error: AI model not configured');
      return;
    }

    // Collect nodes
    statusCallback('Collecting nodes...');
    const nodeGraphModel = NodeGraphContextTmp.nodeGraph.model;
    const nodes = collectNodes(nodeGraphModel);

    if (nodes.length === 0) {
      statusCallback('No nodes found to format');
      return;
    }

    // Extract design tokens
    const designTokens = extractDesignTokens();

    // Create primer and messages
    statusCallback('Analyzing formatting...');
    const primer = generateFormatPrimer(nodes, designTokens);
    const messages = [
      { role: 'system', content: primer },
      { role: 'user', content: prompt }
    ];

    // Stream AI response
    const ctx = new AiCopilotContext(null, null, null);
    const undoGroup = new UndoActionGroup({ label: 'AI: Format nodes' });
    let modificationsApplied = 0;

    await ctx.chatStreamXml({
      messages,
      provider: {
        model: OpenAiStore.getModel(),
        temperature: 0.1
      },
      onTagOpen(tagName: string, attributes: Record<string, string>) {
        if (tagName !== 'modify') return;

        const nodeId = attributes.nodeId;
        if (!nodeId) {
          console.warn('Format command: modify tag missing nodeId');
          return;
        }

        const node = ProjectModel.instance.findNodeWithId(nodeId);
        if (!node) {
          console.warn('Format command: Node not found:', nodeId);
          return;
        }

        // Apply each attribute as a parameter
        for (const [key, value] of Object.entries(attributes)) {
          if (key === 'nodeId') continue;

          try {
            // Handle position separately
            if (key === 'x' || key === 'y') {
              const numValue = parseFloat(value);
              if (!isNaN(numValue)) {
                node[key] = numValue;
                modificationsApplied++;
              }
            } else {
              // Transform and set parameter
              const transformedValue = transformValue(key, value);
              node.setParameter(key, transformedValue, { undo: undoGroup });
              modificationsApplied++;
            }
          } catch (error) {
            console.error('Failed to set property:', key, value, error);
            // Continue with other properties
          }
        }
      }
    });

    // Push undo group if changes were made
    if (modificationsApplied > 0) {
      UndoQueue.instance.push(undoGroup);
      statusCallback(`Formatting complete (${modificationsApplied} changes)`);
    } else {
      statusCallback('No formatting changes applied');
    }
  } catch (error) {
    console.error('Format command error:', error);

    // Provide specific error messages
    if (error.message?.includes('rate limit')) {
      statusCallback('Rate limit reached. Please try again in a moment.');
    } else if (error.message?.includes('timeout')) {
      statusCallback('Request timed out. Please try again.');
    } else if (error.message?.includes('authentication') || error.message?.includes('API key')) {
      statusCallback('OpenAI authentication failed. Check your API key in settings.');
    } else {
      statusCallback('Formatting failed: ' + (error.message || 'Unknown error'));
    }
  }
}

function collectNodes(nodeGraphModel: NodeGraphModel): SerializedNode[] {
  const nodes: SerializedNode[] = [];

  function traverseNode(node: NodeGraphNode): SerializedNode {
    const serialized: SerializedNode = {
      id: node.id,
      type: node.type.name,
      label: node.label,
      parameters: node.parameters,
      x: node.x,
      y: node.y,
      children: []
    };

    if (node.children && node.children.length > 0) {
      serialized.children = node.children.map((child) => traverseNode(child));
    }

    return serialized;
  }

  if (nodeGraphModel.roots) {
    nodeGraphModel.roots.forEach((root) => {
      nodes.push(traverseNode(root));
    });
  }

  return nodes;
}

function extractDesignTokens(): DesignTokens {
  try {
    const stylesModel = new StylesModel();
    const colorStyles = stylesModel.getStyles('colors');
    const textStyles = stylesModel.getStyles('text');

    // Extract color values from color styles
    const colors: string[] = [];
    if (colorStyles && Array.isArray(colorStyles)) {
      colorStyles.forEach((style: any) => {
        if (style.value) {
          colors.push(style.value);
        }
      });
    }

    return {
      colors: colors.length > 0 ? colors : [],
      textStyles: textStyles || []
    };
  } catch (error) {
    console.warn('Failed to extract design tokens:', error);
    return {
      colors: [],
      textStyles: []
    };
  }
}

function generateFormatPrimer(nodes: SerializedNode[], designTokens: DesignTokens): string {
  const nodesJson = JSON.stringify(nodes, null, 2);

  const colorsSection =
    designTokens.colors.length > 0
      ? `Colors: ${designTokens.colors.join(', ')}`
      : 'Colors: No design tokens defined in project';

  const textStylesSection =
    designTokens.textStyles.length > 0
      ? `Text Styles: ${designTokens.textStyles.map((s: any) => s.name || 'Unnamed').join(', ')}`
      : 'Text Styles: No text styles defined in project';

  return `You are a UI formatting assistant. Analyze the provided nodes and apply formatting improvements based on the user's request.

**Current Design Tokens:**
${colorsSection}
${textStylesSection}

**Available Nodes:**
${nodesJson}

**Output Format:**
Respond with XML using <modify> tags. Each tag must have a nodeId attribute matching an existing node ID, and all modifications as attributes.

Example:
<modify nodeId="abc-123" backgroundColor="#ffffff" paddingTop="16" x="100" y="200" />
<modify nodeId="def-456" borderRadius="8" flexDirection="row" />

**Modifiable Properties:**

Colors:
- backgroundColor: hex color (e.g., "#ffffff") or "transparent"
- textColor: hex color
- borderColor: hex color
- Use design tokens from the project when possible

Spacing (use values: 0, 8, 16, 32):
- paddingTop, paddingBottom, paddingLeft, paddingRight: spacing values
- marginTop, marginBottom, marginLeft, marginRight: spacing values

Positioning:
- x: number (canvas x coordinate)
- y: number (canvas y coordinate)

Layout:
- flexDirection: "row" | "column"
- justifyContent: "flex-start" | "flex-end" | "center" | "space-between" | "space-around"
- alignItems: "flex-start" | "flex-end" | "center" | "stretch"
- position: "absolute" | "relative"

Visual:
- borderRadius: number in pixels
- borderWidth: number in pixels
- borderStyle: "solid" | "dashed" | "dotted"
- boxShadow: shadow definition (e.g., "0 2px 4px rgba(0,0,0,0.1)")
- clip: true | false (enable clipping with borderRadius)

Typography (for Text nodes):
- fontSize: number in pixels
- fontWeight: number (e.g., 400, 700)
- textAlign: "left" | "center" | "right"

Size:
- width: number or percentage string
- height: number
- sizeMode: "contentHeight" | "explicit"

**Rules:**
1. Only modify nodes that match the user's request
2. Preserve functionality - don't break existing behavior
3. Use consistent spacing scale (0, 8, 16, 32)
4. Ensure good contrast for accessibility
5. Respect design tokens when available
6. Only output <modify> tags, no other text or explanations
7. Include nodeId attribute for every <modify> tag
8. All modifications must be attributes, not nested elements

**Important:**
- For padding/margin values, use numbers only (e.g., paddingTop="16", not paddingTop="16px")
- For colors, use hex format with # (e.g., backgroundColor="#ffffff")
- For boolean values, use "true" or "false" as strings
- Only modify properties that need to change based on the user's request`;
}

function transformValue(name: string, value: string): any {
  // Handle spacing and size properties
  if (
    [
      'marginTop',
      'marginBottom',
      'marginLeft',
      'marginRight',
      'paddingTop',
      'paddingBottom',
      'paddingLeft',
      'paddingRight',
      'width',
      'height',
      'borderRadius',
      'borderWidth',
      'fontSize'
    ].indexOf(name) !== -1
  ) {
    if (value === 'auto') {
      return undefined;
    }

    if (value.endsWith('%')) {
      return { value: Number(value.substring(0, value.length - 1)), unit: '%' };
    }

    const numValue = Number(value);
    if (!isNaN(numValue)) {
      return { value: numValue, unit: 'px' };
    }

    return value;
  }

  // Handle boolean values
  if (name === 'clip' || name === 'useLabel') {
    return value === 'true';
  }

  // Handle numeric values
  if (name === 'fontWeight') {
    const numValue = Number(value);
    return !isNaN(numValue) ? numValue : value;
  }

  // Return as-is for strings (colors, text, etc.)
  return value;
}
