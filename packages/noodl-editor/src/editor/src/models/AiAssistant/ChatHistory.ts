import { AiAssistantModel } from '@noodl-models/AiAssistant/AiAssistantModel';
import { AiUtils } from '@noodl-models/AiAssistant/context/ai-utils';
import { Model } from '@noodl-utils/model';

// Memory management constants
const MAX_MESSAGES = 50; // Maximum messages before truncation
const TRUNCATE_TO = 30; // Keep most recent N messages after truncation

export enum ChatMessageType {
  User = 'user',
  Assistant = 'assistant',
  System = 'system'
}

export enum ChatHistoryState {
  Idle,
  Processing
}

export type ChatHistoryActivityId = 'processing' | 'code-generation';

export type ChatHistoryActivity = {
  id: ChatHistoryActivityId | string;
  name: string;
  status?: string;
};

export type ChatMessage = {
  snowflakeId: string;
  type: ChatMessageType;
  content: string;
  metadata: Record<string, unknown>;
};

export type ChatSuggestion = {
  id: string;
  text: string;
};

export enum ChatHistoryEvent {
  MessagesChanged,
  ActivitiesChanged,
  MetadataChanged
}

type ChatHistoryEvents = {
  [ChatHistoryEvent.MessagesChanged]: () => void;
  [ChatHistoryEvent.ActivitiesChanged]: (activities: readonly ChatHistoryActivity[]) => void;
  [ChatHistoryEvent.MetadataChanged]: () => void;
};

export class ChatHistory extends Model<ChatHistoryEvent, ChatHistoryEvents> {
  private _messages: ChatMessage[] = [];
  private _activities: ChatHistoryActivity[] = [];
  private _metadata: Record<string, unknown>;

  get messages() {
    return this._messages;
  }

  get metadata() {
    return this._metadata;
  }

  get activities() {
    return this._activities;
  }

  get suggestions(): readonly ChatSuggestion[] {
    if (this._messages.length > 0) {
      const metadata = this._messages[this._messages.length - 1].metadata;
      return (metadata.suggestions as ChatSuggestion[]) || [];
    }

    // When there are no messages,
    // show a list of example suggestions
    const template = AiAssistantModel.instance.templates.find((x) => x.templateId === this.metadata.templateId);
    if (template) {
      return template.examples.map((x) => ({
        id: x,
        text: x
      }));
    }

    return [];
  }

  constructor(items: ChatMessage[], metadata: Record<string, unknown> = {}) {
    super();
    this._messages = items || [];
    this._metadata = metadata || {};
  }

  addActivity(activity: ChatHistoryActivity) {
    this._activities.push(activity);
    this.notifyListeners(ChatHistoryEvent.ActivitiesChanged, this._activities);
  }

  removeActivity(activityId: string) {
    const length = this._activities.length;
    this._activities = this._activities.filter((x) => x.id !== activityId);
    if (this._activities.length !== length) {
      this.notifyListeners(ChatHistoryEvent.ActivitiesChanged, this._activities);
    }
  }

  clearActivities() {
    if (this._activities.length === 0) return;
    this._activities.length = 0;
    this.notifyListeners(ChatHistoryEvent.ActivitiesChanged, this._activities);
  }

  add(message: PartialWithRequired<ChatMessage, 'content'>) {
    if (!message) {
      throw new Error();
    }

    message.snowflakeId = AiUtils.generateSnowflakeId();
    if (!message.type) message.type = ChatMessageType.User;
    if (!message.metadata) message.metadata = {};

    this.messages.push(message as ChatMessage);
    this.notifyListeners(ChatHistoryEvent.MessagesChanged);
    this.truncateIfNeeded();

    return message.snowflakeId;
  }

  /**
   * Truncates old messages when limit exceeded, keeping most recent messages
   * Preserves at least first message (system prompt) if it exists
   */
  private truncateIfNeeded(): void {
    if (this._messages.length <= MAX_MESSAGES) return;
    
    // Keep first message (usually system prompt) and most recent messages
    const firstMessage = this._messages[0]?.type === ChatMessageType.System ? [this._messages[0]] : [];
    const recentMessages = this._messages.slice(-TRUNCATE_TO);
    
    this._messages = [...firstMessage, ...recentMessages];
    
    console.log(`Chat history truncated to ${this._messages.length} messages`);
  }

  updateLast(data?: Partial<Pick<ChatMessage, 'content' | 'metadata'>>) {
    if (data.content) {
      this.messages[this.messages.length - 1].content = data.content;
    }
    if (data.metadata) {
      this.messages[this.messages.length - 1].metadata = {
        ...this.messages[this.messages.length - 1].metadata,
        ...data.metadata
      };
    }

    this.notifyListeners(ChatHistoryEvent.MessagesChanged);
  }

  clear(): void {
    this._messages.length = 0;
    // this.copilot.notifyListeners(CopilotEvent.MessagesChanged);
  }

  removeLast(): void {
    this._messages.pop();
  }

  toJSON() {
    return {
      history: this._messages,
      metadata: this._metadata
    };
  }

  static fromJSON(json: any) {
    return new ChatHistory(json?.history, json?.metadata);
  }
}

export interface CreateNodeFileOptions {
  nodeId: string;
  templateId: string;
}
