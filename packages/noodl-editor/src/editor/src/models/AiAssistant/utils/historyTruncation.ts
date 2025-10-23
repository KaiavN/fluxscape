/**
 * History Truncation Utility
 * Intelligently truncates chat history to fit within token limits
 */

interface ChatMessage {
  role: string;
  content: string;
}

const CHARS_PER_TOKEN = 4; // Approximate estimation
const RESPONSE_RESERVE = 1000; // Tokens reserved for AI response

/**
 * Model token limits
 */
const MODEL_TOKEN_LIMITS: Record<string, number> = {
  'gpt-3.5-turbo': 4096,
  'gpt-4': 8192
};

/**
 * Truncate chat history to fit within token limits
 *
 * @param history - Array of chat messages
 * @param modelName - Name of the AI model being used
 * @param systemPromptLength - Length of system prompt in characters
 * @param codeLength - Length of code context in characters (if any)
 * @returns Truncated history that fits within token limits
 */
export function truncateHistoryForTokenLimit(
  history: ChatMessage[],
  modelName: string,
  systemPromptLength: number,
  codeLength: number = 0
): ChatMessage[] {
  // Get max tokens for model (default to GPT-3.5 limit if unknown)
  const maxTokens = MODEL_TOKEN_LIMITS[modelName] || 4096;

  // Calculate tokens used by system prompt and code
  const usedTokens = (systemPromptLength + codeLength) / CHARS_PER_TOKEN;
  const availableForHistory = maxTokens - usedTokens - RESPONSE_RESERVE;

  // If not enough space, return only last message
  if (availableForHistory < 100) {
    return history.length > 0 ? [history[history.length - 1]] : [];
  }

  // Calculate history size and truncate from beginning if needed
  let historyTokens = 0;
  let startIndex = 0;

  // Work backwards from most recent messages
  for (let i = history.length - 1; i >= 0; i--) {
    const messageTokens = history[i].content.length / CHARS_PER_TOKEN;

    // If adding this message would exceed limit and we have at least 2 messages, stop here
    if (historyTokens + messageTokens > availableForHistory && i < history.length - 2) {
      startIndex = i + 1;
      break;
    }

    historyTokens += messageTokens;
  }

  return history.slice(startIndex);
}
