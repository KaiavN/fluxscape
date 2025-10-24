import { OpenAiStore } from '@noodl-store/AiAssistantStore';

import { extractDatabaseSchema } from '@noodl-models/AiAssistant/DatabaseSchemaExtractor';
import { AiNodeTemplate } from '@noodl-models/AiAssistant/interfaces';
import * as QueryGPT4 from '@noodl-models/AiAssistant/templates/function-query-database/gpt-4-version';
import { ChatMessageType } from '@noodl-models/AiAssistant/ChatHistory';

export const template: AiNodeTemplate = {
  type: 'green',
  name: 'JavaScriptFunction',
  nodeDisplayName: 'Read Database',
  onMessage: async (context) => {
    const version = OpenAiStore.getVersion();

    const activityId = 'processing';
    const activityCodeGenId = 'code-generation';

    context.chatHistory.addActivity({
      id: activityId,
      name: 'Processing'
    });

    context.chatHistory.addActivity({
      id: activityCodeGenId,
      name: 'Generating code...'
    });

    // ---
    // Database
    const dbCollectionsSource = await extractDatabaseSchema();
    console.log('database schema', dbCollectionsSource);

    // Check if database schema exists
    if (!dbCollectionsSource || dbCollectionsSource.trim().length === 0) {
      context.chatHistory.removeActivity(activityCodeGenId);
      context.chatHistory.removeActivity(activityId);
      context.chatHistory.add({
        type: ChatMessageType.Assistant,
        content: 'No database found. Please set up your database first in the project settings.'
      });
      return;
    }

    // ---
    console.log('using version: ', version);

    await QueryGPT4.execute(context, dbCollectionsSource);

    context.chatHistory.removeActivity(activityCodeGenId);
    context.chatHistory.removeActivity(activityId);
  }
};
