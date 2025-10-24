import { ChatMessageType } from '@noodl-models/AiAssistant/ChatHistory';
import { AiNodeTemplate, IAiCopilotContext } from '@noodl-models/AiAssistant/interfaces';
import { OpenAiStore } from '@noodl-store/AiAssistantStore';

export const template: AiNodeTemplate = {
  type: 'data',
  name: 'REST2',
  nodeDisplayName: 'API Call',
  onMessage: async ({ node, chatHistory, chatStreamXml }: IAiCopilotContext) => {
    const activityId = 'configuring-api';
    chatHistory.addActivity({
      id: activityId,
      name: 'Configuring API call...'
    });

    const userMessage = chatHistory.messages.at(-1).content;

    const messages = [
      {
        role: 'system',
        content: API_CONTEXT
      },
      {
        role: 'user',
        content: userMessage
      }
    ];

    try {
      let resource = '';
      let method = 'GET';
      let requestScript = '';
      let responseScript = '';
      let explanation = '';

      await chatStreamXml({
        messages,
        provider: {
          model: OpenAiStore.getModel(),
          temperature: 0.0,
          max_tokens: 2048
        },
        onTagEnd(tagName, fullText) {
          console.log('[api-config]', tagName, fullText);

          switch (tagName) {
            case 'resource':
              resource = fullText;
              break;
            case 'method':
              method = fullText.toUpperCase();
              break;
            case 'requestScript':
              requestScript = fullText;
              break;
            case 'responseScript':
              responseScript = fullText;
              break;
            case 'explain':
              explanation = fullText;
              break;
          }
        }
      });

      if (!resource || !method) {
        chatHistory.removeActivity(activityId);
        chatHistory.add({
          type: ChatMessageType.Assistant,
          content: 'Could not configure API call. Please provide more details about the API endpoint.'
        });
        return;
      }

      // Configure the REST node
      node.setParameter('resource', resource);
      node.setParameter('method', method);
      if (requestScript) {
        node.setParameter('requestScript', requestScript);
      }
      if (responseScript) {
        node.setParameter('responseScript', responseScript);
      }

      chatHistory.removeActivity(activityId);
      chatHistory.add({
        type: ChatMessageType.Assistant,
        content: explanation || 'API call has been configured successfully.'
      });
    } catch (error) {
      console.error('API configuration failed:', error);
      chatHistory.removeActivity(activityId);
      chatHistory.add({
        type: ChatMessageType.Assistant,
        content: 'I encountered an error configuring the API call. Please try again or provide more details.'
      });
    }
  }
};

const API_CONTEXT = `You are configuring a REST API call for Noodl.

You need to provide:
1. Resource URL (with {parameter} placeholders for dynamic values)
2. HTTP Method (GET, POST, PUT, DELETE)
3. Request script (to prepare headers, auth, body) - OPTIONAL
4. Response script (to extract data from response) - OPTIONAL

Request script has access to:
- Inputs (user inputs)
- Request.headers (add headers here as object)
- Request.parameters (URL parameters as object)
- Request.content (request body as object)

Response script has access to:
- Response.content (response body as object)
- Response.status (HTTP status code)
- Outputs (set output values here)

###Example 1: Simple GET###
<resource>https://api.openweathermap.org/data/2.5/weather?q={city}&appid={apiKey}</resource>
<method>GET</method>
<requestScript>
// No request script needed for simple GET
</requestScript>
<responseScript>
Outputs.Temperature = Response.content.main.temp;
Outputs.Weather = Response.content.weather[0].description;
</responseScript>
<explain>Fetches weather data from OpenWeather API for a given city.</explain>

###Example 2: POST with authentication###
<resource>https://api.example.com/messages</resource>
<method>POST</method>
<requestScript>
Request.headers = {
  'Authorization': 'Bearer ' + Inputs.ApiKey,
  'Content-Type': 'application/json'
};
Request.content = {
  message: Inputs.Message,
  userId: Inputs.UserId
};
</requestScript>
<responseScript>
Outputs.MessageId = Response.content.id;
Outputs.Success = Response.status === 200;
</responseScript>
<explain>Posts a message to the API with authentication.</explain>

###Task###
Respond only with this specific format:
<resource>URL with {parameters}</resource>
<method>GET|POST|PUT|DELETE</method>
<requestScript>JavaScript code (if needed)</requestScript>
<responseScript>JavaScript code (if needed)</responseScript>
<explain>Explanation of API call</explain>`;
