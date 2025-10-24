import { ChatMessageType } from '@noodl-models/AiAssistant/ChatHistory';
import { AiNodeTemplate, IAiCopilotContext } from '@noodl-models/AiAssistant/interfaces';
import { extractCodeBlock } from '@noodl-models/AiAssistant/templates/helper';
import { OpenAiStore } from '@noodl-store/AiAssistantStore';

export const template: AiNodeTemplate = {
  type: 'green',
  name: 'JavaScriptFunction',
  nodeDisplayName: 'Validate Data',
  onMessage: async ({ node, chatHistory, chatStream }: IAiCopilotContext) => {
    const activityId = 'validating';
    chatHistory.addActivity({
      id: activityId,
      name: 'Generating validation...'
    });

    const userMessage = chatHistory.messages.at(-1).content;

    const messages = [
      {
        role: 'system',
        content: VALIDATE_CONTEXT
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
          content: 'Could not generate validation code. Please try again with a clearer description.'
        });
        return;
      }

      // Validate the code
      try {
        const wrappedCode = `async function validateCode() { ${codeText} }`;
        new Function(wrappedCode);
      } catch (error) {
        console.error('Validation code validation failed:', error);
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
        content: 'Validation function has been created successfully.',
        metadata: {
          code: codeText
        }
      });
    } catch (error) {
      console.error('Validation generation failed:', error);
      chatHistory.removeActivity(activityId);
      chatHistory.add({
        type: ChatMessageType.Assistant,
        content: 'I encountered an error generating the validation. Please try again or rephrase your request.'
      });
    }
  }
};

const VALIDATE_CONTEXT = `You are creating a validation function for Noodl.

Guidelines:
- Create appropriate input names based on what needs to be validated
- Output Outputs.IsValid = true/false
- Output Outputs.ErrorMessage with specific error if invalid
- Call Outputs.Valid() signal if valid
- Call Outputs.Invalid() signal if invalid
- Handle all edge cases
- Add helpful comments

Common validations:
- Email: Use regex /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/
- Required: Check for null/undefined/empty string
- Min/max length: Use .length property
- Number range: Compare with < and >
- Phone numbers, URLs, dates, etc.

###Example###
\`\`\`javascript
// Validate email format
const email = Inputs.Email || '';

if (!email || email.trim().length === 0) {
  Outputs.IsValid = false;
  Outputs.ErrorMessage = 'Email is required';
  Outputs.Invalid();
  return;
}

const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
if (!emailRegex.test(email)) {
  Outputs.IsValid = false;
  Outputs.ErrorMessage = 'Invalid email format';
  Outputs.Invalid();
  return;
}

Outputs.IsValid = true;
Outputs.ErrorMessage = '';
Outputs.Valid();
\`\`\`

###Task###
ONLY respond with JavaScript code following the instructions and starting and ending with \`\`\`.`;
