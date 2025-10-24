var OpenRouterNode = {
  name: 'OpenRouter',
  displayNodeName: 'OpenRouter Chat',
  category: 'Data',
  color: 'purple',
  searchTags: ['ai', 'chat', 'openrouter', 'llm', 'gpt'],
  initialize: function () {
    this._internal.messages = [];
    this._internal.streamingText = '';
    this._internal.fullResponse = '';
    this._internal.apiKey = '';
    this._internal.model = 'openai/gpt-4';
    this._internal.systemPrompt = '';
    this._internal.userMessage = '';
    this._internal.temperature = 0.7;
    this._internal.maxTokens = 2048;
  },
  inputs: {
    apiKey: {
      type: 'string',
      displayName: 'API Key',
      group: 'Settings',
      set: function (value) {
        this._internal.apiKey = value;
      }
    },
    model: {
      type: 'string',
      displayName: 'Model',
      group: 'Settings',
      default: 'openai/gpt-4',
      set: function (value) {
        this._internal.model = value;
      }
    },
    systemPrompt: {
      type: 'string',
      displayName: 'System Prompt',
      group: 'Settings',
      set: function (value) {
        this._internal.systemPrompt = value;
      }
    },
    userMessage: {
      type: 'string',
      displayName: 'User Message',
      group: 'Inputs',
      set: function (value) {
        this._internal.userMessage = value;
      }
    },
    temperature: {
      type: 'number',
      displayName: 'Temperature',
      group: 'Settings',
      default: 0.7,
      set: function (value) {
        this._internal.temperature = value;
      }
    },
    maxTokens: {
      type: 'number',
      displayName: 'Max Tokens',
      group: 'Settings',
      default: 2048,
      set: function (value) {
        this._internal.maxTokens = value;
      }
    },
    send: {
      type: 'signal',
      displayName: 'Send',
      group: 'Actions',
      valueChangedToTrue: function () {
        this.sendMessage();
      }
    },
    clearHistory: {
      type: 'signal',
      displayName: 'Clear History',
      group: 'Actions',
      valueChangedToTrue: function () {
        this._internal.messages = [];
        this._internal.streamingText = '';
        this._internal.fullResponse = '';
      }
    }
  },
  outputs: {
    response: {
      type: 'string',
      displayName: 'Response',
      group: 'Outputs',
      getter: function () {
        return this._internal.streamingText;
      }
    },
    fullResponse: {
      type: 'string',
      displayName: 'Full Response',
      group: 'Outputs',
      getter: function () {
        return this._internal.fullResponse;
      }
    },
    streaming: {
      type: 'signal',
      displayName: 'Streaming',
      group: 'Events'
    },
    completed: {
      type: 'signal',
      displayName: 'Completed',
      group: 'Events'
    },
    error: {
      type: 'signal',
      displayName: 'Error',
      group: 'Events'
    }
  },
  prototypeExtensions: {
    sendMessage: function () {
      // Validation
      if (!this._internal.apiKey) {
        console.error('OpenRouter: API key is required');
        this.sendSignalOnOutput('error');
        return;
      }
      if (!this._internal.userMessage) {
        console.error('OpenRouter: User message is required');
        this.sendSignalOnOutput('error');
        return;
      }

      // Build messages array
      var messages = this._internal.messages.slice(); // Copy array
      if (this._internal.systemPrompt) {
        messages.unshift({
          role: 'system',
          content: this._internal.systemPrompt
        });
      }
      messages.push({
        role: 'user',
        content: this._internal.userMessage
      });

      // Reset streaming text
      this._internal.streamingText = '';

      // Make streaming request
      var _this = this;
      this.streamOpenRouterRequest(messages)
        .catch(function (error) {
          console.error('OpenRouter error:', error);
          _this.sendSignalOnOutput('error');
        });
    },

    streamOpenRouterRequest: function (messages) {
      var _this = this;
      var url = 'https://openrouter.ai/api/v1/chat/completions';

      if (typeof _noodl_cloud_runtime_version === 'undefined') {
        // Running in browser
        return fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + this._internal.apiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: this._internal.model || 'openai/gpt-4',
            messages: messages,
            temperature: this._internal.temperature || 0.7,
            max_tokens: this._internal.maxTokens || 2048,
            stream: true
          })
        }).then(function (response) {
          if (!response.ok) {
            throw new Error('OpenRouter API error: ' + response.status);
          }

          // Read streaming response
          var reader = response.body.getReader();
          var decoder = new TextDecoder();
          var buffer = '';

          function readChunk() {
            return reader.read().then(function (result) {
              if (result.done) {
                return;
              }

              buffer += decoder.decode(result.value, { stream: true });
              var lines = buffer.split('\n');
              buffer = lines.pop(); // Keep incomplete line in buffer

              for (var i = 0; i < lines.length; i++) {
                var line = lines[i];
                if (line.startsWith('data: ')) {
                  var data = line.slice(6);
                  if (data === '[DONE]') {
                    _this._internal.fullResponse = _this._internal.streamingText;
                    _this._internal.messages.push({
                      role: 'user',
                      content: _this._internal.userMessage
                    });
                    _this._internal.messages.push({
                      role: 'assistant',
                      content: _this._internal.streamingText
                    });
                    _this.flagOutputDirty('fullResponse');
                    _this.sendSignalOnOutput('completed');
                    return;
                  }

                  try {
                    var json = JSON.parse(data);
                    var delta = json.choices && json.choices[0] && json.choices[0].delta && json.choices[0].delta.content;
                    if (delta) {
                      _this._internal.streamingText += delta;
                      _this.flagOutputDirty('response');
                      _this.sendSignalOnOutput('streaming');
                    }
                  } catch (e) {
                    // Ignore JSON parse errors in streaming
                  }
                }
              }

              return readChunk();
            });
          }

          return readChunk();
        });
      } else {
        // Running in cloud runtime - use fetch with stream
        return fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + this._internal.apiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: this._internal.model || 'openai/gpt-4',
            messages: messages,
            temperature: this._internal.temperature || 0.7,
            max_tokens: this._internal.maxTokens || 2048,
            stream: true
          })
        }).then(function (response) {
          if (!response.ok) {
            throw new Error('OpenRouter API error: ' + response.status);
          }

          return response.text().then(function (text) {
            // Process all chunks at once in cloud runtime
            var lines = text.split('\n');
            for (var i = 0; i < lines.length; i++) {
              var line = lines[i];
              if (line.startsWith('data: ')) {
                var data = line.slice(6);
                if (data === '[DONE]') {
                  _this._internal.fullResponse = _this._internal.streamingText;
                  _this._internal.messages.push({
                    role: 'user',
                    content: _this._internal.userMessage
                  });
                  _this._internal.messages.push({
                    role: 'assistant',
                    content: _this._internal.streamingText
                  });
                  _this.flagOutputDirty('fullResponse');
                  _this.sendSignalOnOutput('completed');
                  return;
                }

                try {
                  var json = JSON.parse(data);
                  var delta = json.choices && json.choices[0] && json.choices[0].delta && json.choices[0].delta.content;
                  if (delta) {
                    _this._internal.streamingText += delta;
                  }
                } catch (e) {
                  // Ignore JSON parse errors
                }
              }
            }

            // Send final outputs for cloud runtime
            _this.flagOutputDirty('response');
            _this.flagOutputDirty('fullResponse');
            _this.sendSignalOnOutput('completed');
          });
        });
      }
    }
  }
};

module.exports = {
  node: OpenRouterNode
};
