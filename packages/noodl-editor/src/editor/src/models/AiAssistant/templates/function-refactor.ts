import { ChatMessageType } from '@noodl-models/AiAssistant/ChatHistory';
import { AiNodeTemplate, IAiCopilotContext } from '@noodl-models/AiAssistant/interfaces';
import { extractCodeBlock } from '@noodl-models/AiAssistant/templates/helper';
import { OpenAiStore } from '@noodl-store/AiAssistantStore';

export const template: AiNodeTemplate = {
  type: 'green',
  name: 'JavaScriptFunction',
  nodeDisplayName: 'Refactor Function',
  onMessage: async ({ node, chatHistory, chatStream }: IAiCopilotContext) => {
    const currentScript = node.getParameter('functionScript');

    // Check if there's existing code to refactor
    if (!currentScript || currentScript.trim().length === 0) {
      chatHistory.add({
        type: ChatMessageType.Assistant,
        content: 'Please create a function first, then use /refactor to improve it.'
      });
      return;
    }

    const activityId = 'refactoring';
    chatHistory.addActivity({
      id: activityId,
      name: 'Refactoring code...'
    });

    const userMessage = chatHistory.messages.at(-1).content;

    const messages = [
      {
        role: 'system',
        content: REFACTOR_CONTEXT.replace('%{code}%', currentScript)
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
          content: 'Could not extract refactored code. Please try again with a clearer request.'
        });
        return;
      }

      // Validate the code
      try {
        const wrappedCode = `async function validateCode() { ${codeText} }`;
        new Function(wrappedCode);
      } catch (error) {
        console.error('Refactored code validation failed:', error);
        chatHistory.removeActivity(activityId);
        chatHistory.add({
          type: ChatMessageType.Assistant,
          content: 'The refactored code is invalid. Keeping original code. Error: ' + error.message
        });
        return;
      }

      // Set the refactored code
      node.setParameter('functionScript', codeText);

      chatHistory.removeActivity(activityId);
      chatHistory.add({
        type: ChatMessageType.Assistant,
        content: 'Code has been refactored successfully. The improved version is now active.',
        metadata: {
          code: codeText
        }
      });
    } catch (error) {
      console.error('Refactoring failed:', error);
      chatHistory.removeActivity(activityId);
      chatHistory.add({
        type: ChatMessageType.Assistant,
        content: 'I encountered an error during refactoring. Please try again or rephrase your request.'
      });
    }
  }
};

const REFACTOR_CONTEXT = `You are refactoring existing JavaScript code for a Noodl function.

Current code:
\`\`\`
%{code}%
\`\`\`

Guidelines for refactoring:
- Maintain the same inputs and outputs (do not change the function signature)
- Improve performance where possible
- Add better error handling
- Improve code readability
- Add helpful comments
- Follow Noodl function patterns (Inputs.X, Outputs.X)
- Remove unnecessary code
- Simplify complex logic

Respond ONLY with the improved JavaScript code in a code block starting and ending with \`\`\`.`;
