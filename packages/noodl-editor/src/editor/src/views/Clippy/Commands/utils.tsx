import path from 'node:path';
import { OpenAiStore } from '@noodl-store/AiAssistantStore';
import { filesystem } from '@noodl/platform';
import ToastLayer from '@noodl-views/ToastLayer';

import { ProjectModel } from '@noodl-models/projectmodel';
import FileSystem from '@noodl-utils/filesystem';
import { guid } from '@noodl-utils/utils';

/**
 * Retry wrapper with exponential backoff
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 2,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < maxRetries) {
        const delay = initialDelay * Math.pow(2, attempt);
        console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

export async function makeImageGenerationRequest(prompt: string): Promise<{ type: string; data: Buffer }> {
  return retryWithBackoff(async () => {
    try {
      const OPENAI_API_KEY = OpenAiStore.getApiKey();
      const response = await fetch(`https://openrouter.ai/api/v1/images/generations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + OPENAI_API_KEY
        },
        body: JSON.stringify({
          model: OpenAiStore.getImageModel(),
          prompt,
          n: 1,
          response_format: 'b64_json'
        })
      });

      const json = await response.json();

      if (json.error) {
        const errorMsg = json.error.message || json.error;
        console.error('Image generation error:', errorMsg);
        ToastLayer.showError(`Image generation failed: ${errorMsg}`);
        throw new Error(errorMsg);
      }

      const b64_json = json.data[0].b64_json;

      return { data: Buffer.from(b64_json, 'base64'), type: 'png' };
    } catch (error) {
      // Handle network errors and other exceptions
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.error('Network error during image generation:', error);
        ToastLayer.showError('Failed to connect to image generation service. Please check your internet connection.');
        throw error;
      }
      // Re-throw if already handled above
      throw error;
    }
  }, 2, 1000); // 2 retries, 1 second initial delay
}

export async function saveImageDataToDisk(imageData: { type: string; data: Buffer }): Promise<string> {
  const projectFolder = ProjectModel.instance._retainedProjectDirectory;
  if (!projectFolder) throw new Error('Project has no folder');

  const filename = `image-${guid()}.${imageData.type}`;
  const folder = 'generated-images';
  const relativeFilePath = path.join(folder, filename);
  const absolutePath = path.join(projectFolder, relativeFilePath);

  await filesystem.makeDirectory(path.join(projectFolder, folder));
  await filesystem.writeFile(absolutePath, imageData.data);

  return relativeFilePath;
}

export async function makeChatRequest(model: string, messages: unknown[]) {
  return retryWithBackoff(async () => {
    try {
      const OPENAI_API_KEY = OpenAiStore.getApiKey();
      const response = await fetch(`https://openrouter.ai/api/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + OPENAI_API_KEY
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.5,
          max_tokens: 2048
        })
      });

      const json = await response.json();
      if (json.error) {
        const errorMsg = json.error.message || json.error;
        console.error('Chat request error:', errorMsg);
        ToastLayer.showError(`AI request failed: ${errorMsg}`);
        throw new Error(errorMsg); // Throw instead of returning null
      } else {
        console.log('API request completed', json.usage);

        return {
          content: json.choices[0].message.content,
          usage: json.usage
        };
      }
    } catch (error) {
      // Handle network errors and JSON parsing errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.error('Network error during chat request:', error);
        ToastLayer.showError('Network error during AI request.');
        throw error;
      }
      if (error instanceof SyntaxError) {
        console.error('JSON parsing error in chat request:', error);
        ToastLayer.showError('Invalid response from AI service.');
        throw error;
      }
      // Unknown error
      console.error('Unexpected error in chat request:', error);
      ToastLayer.showError('AI request failed unexpectedly.');
      throw error;
    }
  }, 2, 1000).catch(() => null); // Return null on final failure for backward compatibility
}
