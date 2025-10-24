import { ChatMessageType } from '@noodl-models/AiAssistant/ChatHistory';
import { AiNodeTemplate, IAiCopilotContext } from '@noodl-models/AiAssistant/interfaces';
import { extractCodeBlock } from '@noodl-models/AiAssistant/templates/helper';
import { OpenAiStore } from '@noodl-store/AiAssistantStore';

export const template: AiNodeTemplate = {
  type: 'green',
  name: 'JavaScriptFunction',
  nodeDisplayName: 'Transform Data',
  onMessage: async ({ node, chatHistory, chatStream }: IAiCopilotContext) => {
    const activityId = 'transforming';
    chatHistory.addActivity({
      id: activityId,
      name: 'Generating transformation...'
    });

    const userMessage = chatHistory.messages.at(-1).content;

    const messages = [
      {
        role: 'system',
        content: TRANSFORM_CONTEXT
      },
      {
        role: 'user',
        content: userMessage
      }
    ];

    try {
      const fullCodeText = await chatStream({
        provider: {
          model: OpenAiStore.getModel(),
          temperature: 0.0,
          max_tokens: 2048
        },
        messages
      });

      const codeText = extractCodeBlock(fullCodeText);

      if (!codeText || codeText.trim().length === 0) {
        chatHistory.removeActivity(activityId);
        chatHistory.add({
          type: ChatMessageType.Assistant,
          content: 'Could not generate transformation code. Please try again with a clearer description.'
        });
        return;
      }

      // Validate the code
      try {
        const wrappedCode = `async function validateCode() { ${codeText} }`;
        new Function(wrappedCode);
      } catch (error) {
        console.error('Transform code validation failed:', error);
        chatHistory.removeActivity(activityId);
        chatHistory.add({
          type: ChatMessageType.Assistant,
          content: 'The generated code is invalid. Error: ' + error.message
        });
        return;
      }

      // Set the code
      node.setParameter('functionScript', codeText);

      chatHistory.removeActivity(activityId);
      chatHistory.add({
        type: ChatMessageType.Assistant,
        content: 'Data transformation function has been created successfully.',
        metadata: {
          code: codeText
        }
      });
    } catch (error) {
      console.error('Transform generation failed:', error);
      chatHistory.removeActivity(activityId);
      chatHistory.add({
        type: ChatMessageType.Assistant,
        content: 'I encountered an error generating the transformation. Please try again or rephrase your request.'
      });
    }
  }
};

const TRANSFORM_CONTEXT = `You are creating a data transformation function for Noodl.

Guidelines:
- Input data comes from Inputs.Data
- Output transformed data to Outputs.Result
- Handle edge cases (empty data, null values, undefined)
- Use Noodl function patterns (Inputs.X, Outputs.X)
- Call Outputs.Success() when done
- Call Outputs.Failure() on error and set Outputs.Error with error message
- Add helpful comments

Common transformations:
- Array to Object (keyed by specific property)
- Object to Array
- Flatten nested structures
- Filter/map/reduce operations
- Extract specific fields
- Merge multiple data sources

###Example###
\`\`\`javascript
// Transform array of users to object keyed by ID
const users = Inputs.Data || [];

if (!users || !Array.isArray(users)) {
  Outputs.Error = 'Input must be an array';
  Outputs.Failure();
  return;
}

try {
  const result = {};
  for (const user of users) {
    if (user.id) {
      result[user.id] = user;
    }
  }

  Outputs.Result = result;
  Outputs.Success();
} catch (error) {
  Outputs.Error = error.message;
  Outputs.Failure();
}
\`\`\`

###Task###
ONLY respond with JavaScript code following the instructions and starting and ending with \`\`\`.`;
