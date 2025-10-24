import { EventStreamContentType, fetchEventSource } from '@microsoft/fetch-event-source';
import { OpenAiStore } from '@noodl-store/AiAssistantStore';
import { ToastLayer } from '@noodl-views/ToastLayer/ToastLayer';

import { AiCopilotChatProviders, AiCopilotChatStreamArgs } from '@noodl-models/AiAssistant/interfaces';

// Retry configuration with exponential backoff
const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  jitterMs: 500
};

function toChatProvider(provider: AiCopilotChatProviders | undefined) {
  return {
    model: provider?.model || 'openai/gpt-4',
    temperature: provider?.temperature,
    max_tokens: provider?.max_tokens
  };
}

/**
 * Calculate exponential backoff delay with jitter
 */
function calculateRetryDelay(attemptNumber: number): number {
  const delay = Math.min(
    RETRY_CONFIG.initialDelayMs * Math.pow(RETRY_CONFIG.backoffMultiplier, attemptNumber),
    RETRY_CONFIG.maxDelayMs
  );
  const jitter = Math.random() * RETRY_CONFIG.jitterMs;
  return delay + jitter;
}

async function directChatOpenAi({ messages, provider, abortController, onEnd, onStream }: AiCopilotChatStreamArgs) {
  const OPENAI_API_KEY = OpenAiStore.getApiKey();
  const controller = abortController || new AbortController();
  let endpoint = `https://openrouter.ai/api/v1/chat/completions`;

  let fullText = '';
  let completionTokenCount = 0;

  let tries = RETRY_CONFIG.maxRetries;
  let currentAttempt = 0;
  
  await fetchEventSource(endpoint, {
    method: 'POST',
    openWhenHidden: true,
    headers: {
      Authorization: 'Bearer ' + OPENAI_API_KEY,
      'Content-Type': 'application/json'
    },
    signal: controller.signal,
    body: JSON.stringify({
      ...toChatProvider(provider),
      messages,
      stream: true
    }),
    async onopen(response) {
      if (response.ok && response.headers.get('content-type').includes(EventStreamContentType)) {
        return; // everything's good
      } else if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        // client-side errors are usually non-retriable:
        throw 'FatalError';
      } else {
        throw 'RetriableError';
      }
    },
    onmessage(ev) {
      if (ev.data === '[DONE]') {
        controller.abort();
        return;
      }

      try {
        const json = JSON.parse(ev.data);
        const delta = json.choices[0].delta.content;
        if (delta) {
          completionTokenCount++;
          fullText += delta;
          console.debug('[stream]', fullText);
          onStream && onStream(fullText, delta);
        }
      } catch (error) {
        console.error('Parsing error in AI stream:', error);
        ToastLayer.showError('Received invalid response from AI service. Please try again.');
      }
    },
    onclose() {
      onEnd && onEnd();
    },
    onerror(err) {
      const errText = err.toString();
      console.error(`AI API error (attempt ${currentAttempt + 1}/${RETRY_CONFIG.maxRetries}):`, err);
      
      if (['FatalError'].includes(errText)) {
        // 4xx errors (except 429) - don't retry
        ToastLayer.showError('AI request failed. Please check your API key and try again.');
        throw err; // rethrow to stop the operation
      } else if (['RetriableError'].includes(errText)) {
        if (tries <= 0) {
          // All retries exhausted
          ToastLayer.showError('AI service is experiencing high traffic. Please try again in a few moments.');
          throw `Apologies, the AI service is currently facing heavy traffic, causing delays in processing requests. Please be patient and try again later.`;
        }
        tries--;
        currentAttempt++;
        
        // Return delay in milliseconds for exponential backoff
        const delay = calculateRetryDelay(currentAttempt);
        console.log(`Retrying API request in ${Math.round(delay)}ms (${tries} attempts remaining)...`);
        return delay;
      } else {
        // Unknown errors - retry with backoff
        if (tries <= 0) {
          ToastLayer.showError('Network connection failed. Please check your internet connection.');
          throw err;
        }
        tries--;
        currentAttempt++;
        
        const delay = calculateRetryDelay(currentAttempt);
        console.log(`Retrying after error in ${Math.round(delay)}ms...`);
        return delay;
      }
    }
  });

  return {
    fullText,
    completionTokenCount
  };
}

export namespace Ai {
  export async function chatStream(args: AiCopilotChatStreamArgs): Promise<string> {
    let fullText = '';

    const version = OpenAiStore.getVersion();
    if (version === 'openrouter') {
      const result = await directChatOpenAi(args);
      fullText = result.fullText;
    } else {
      throw 'Invalid AI version.';
    }

    return fullText;
  }
}
