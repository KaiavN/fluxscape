import { ReActCommand, ReActCommandLexer } from '@noodl-models/AiAssistant/_backend/commandLexer';
import { Parser } from '@noodl-models/AiAssistant/_backend/parser';
import { Ai } from '@noodl-models/AiAssistant/context/ai-api';
import { AiCopilotChatArgs, AiCopilotChatStreamXmlArgs } from '@noodl-models/AiAssistant/interfaces';

export namespace AiQuery {
  export async function chatReAct({
    messages,
    provider,
    abortController
  }: AiCopilotChatArgs): Promise<{ commands: readonly ReActCommand[]; fullText: string }> {
    const parser = new ReActCommandLexer();
    let fullText = '';

    await Ai.chatStream({
      provider,
      messages,
      abortController,
      onStream: (_, text) => {
        if (text) {
          fullText += text;
          parser.append(text);
        }
      }
    });

    return {
      commands: parser.commands,
      fullText
    };
  }

  export async function chatStreamXml({
    messages,
    provider,
    abortController,
    onEnd,
    onStream,
    onTagOpen,
    onTagEnd
  }: AiCopilotChatStreamXmlArgs): Promise<string> {
    // Debouncing state for stream updates
    let streamBuffer: { tagName: string; text: string } | null = null;
    let lastUpdateTime = 0;
    const UPDATE_INTERVAL = 16; // ~60fps (milliseconds)

    const flushBuffer = () => {
      if (streamBuffer && onStream) {
        onStream(streamBuffer.tagName, streamBuffer.text);
      }
      streamBuffer = null;
    };

    const parser = new Parser(
      (tagName, text) => {
        console.debug(tagName, text);
        
        // Debounce rapid stream updates to reduce re-renders
        const now = Date.now();
        if (now - lastUpdateTime < UPDATE_INTERVAL) {
          streamBuffer = { tagName, text }; // Buffer the update
          return;
        }
        
        lastUpdateTime = now;
        onStream && onStream(tagName, text);
      },
      (tagName, attributes) => {
        // Keep structural changes immediate (no debouncing)
        onTagOpen && onTagOpen(tagName, attributes);
      },
      (tagName, fullText) => {
        // Keep structural changes immediate (no debouncing)
        // Flush any pending buffer before tag ends
        flushBuffer();
        onTagEnd && onTagEnd(tagName, fullText);
      }
    );

    await Ai.chatStream({
      provider,
      messages,
      abortController,
      onEnd,
      onStream: (_, text) => {
        if (text) {
          parser.append(text);
        }
      }
    });

    // Ensure final buffered update is sent
    flushBuffer();

    return parser.getFullText();
  }
}
