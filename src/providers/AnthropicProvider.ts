import { AIProviderType, AIProvider, AIRequest, AIResponse } from '../types';
import { Configuration } from '@nomyx/multi-context-objects';
import axios from 'axios';
import { execPromise } from '../utils/utils';


export default class AnthropicProvider implements AIProvider {
  private config: Configuration;
  constructor(config: Configuration) {
    this.config = config;
  }
  async processRequest(request: AIRequest): Promise<AIResponse> {
    const { prompt, maxTokens = 4096, temperature = 0 } = request;
    const messages = [{ role: 'user', content: prompt }];
    return this.makeAnthropicRequest(messages, { max_tokens: maxTokens, temperature });
  }

  async generateResponse(prompt: string): Promise<string> {
    const response = await this.processRequest({ prompt });
    return response.response;
  }

  private async makeAnthropicRequest(messages: any[], options = {
    max_tokens: 4096,
    temperature: 0
  }): Promise<AIResponse> {
    try {
      const { stdout: token } = await execPromise('gcloud auth print-access-token');
      const authToken = token.trim();
      const MODEL = this.config.getAnthropicModel();
      const LOCATION = this.config.getAnthropicLocation();
      const PROJECT_ID = this.config.getGcloudProjectId();
      const url = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/anthropic/models/${MODEL}:streamRawPredict`;

      const requestData = {
        anthropic_version: "vertex-2023-10-16",
        messages: messages.map((m: any) => ({
          role: m.role,
          content: [{ type: "text", text: m.content }]
        })),
        max_tokens: options.max_tokens || 4096,
        temperature: options.temperature || 0,
        stream: false
      };

      const response = await axios({
        method: 'post',
        url: url,
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json; charset=utf-8'
        },
        data: requestData,
        responseType: 'json'
      });

      return {
        response: response.data.content[0].text,
        usage: {
          total: response.data.content[0].text.length,
          available: response.data.content[0].text.length,
          reset: 0
        }
      } as any;
    } catch (error) {
      console.error('Error in makeAnthropicRequest:', error);
      throw error;
    }
  }

  async chat(messages: any, options: any = {}): Promise<any> {
    const response = await this.makeAnthropicRequest(messages, options);
    return response;
  }

  toJSON() {
    return { name: 'AnthropicProvider' };
  }
}