import { AIProviderType, AIProvider, AIRequest, AIResponse } from '../types'
import axios from 'axios';
import { Configuration } from '@nomyx/multi-context-objects';
import { execPromise } from '../utils/utils';

export default class MetaProvider implements AIProvider {
  private config: Configuration;
  constructor(config: Configuration) {
    this.config = config;
  }
  async processRequest(request: AIRequest): Promise<AIResponse> {
    const { prompt, maxTokens = 2000, temperature = 0 } = request;
    const messages = [{ role: 'user', content: prompt }];
    return this.makeLlama31Request(messages, { maxTokens, temperature });
  }

  async generateResponse(prompt: string): Promise<string> {
    const response = await this.processRequest({ prompt });
    return response.response;
  }

  private async makeLlama31Request(messages: any[], options = {
    maxTokens: 2000,
    temperature: 0
  }): Promise<AIResponse> {
    try {
      const { stdout: token } = await execPromise('gcloud auth print-access-token');
      const authToken = token.trim();
      const ENDPOINT = this.config.getLlamaEndpoint() || 'us-central1-aiplatform.googleapis.com';
      const PROJECT_ID = this.config.getGcloudProjectId();
      const REGION = this.config.getGcloudRegion() || 'us-central1';
      const url = `https://${ENDPOINT}/v1beta1/projects/${PROJECT_ID}/locations/${REGION}/endpoints/openapi/chat/completions`;

      const requestData = {
        model: "meta/llama3-405b-instruct-maas",
        messages: messages.map((m: any) => ({
          role: m.role,
          content: m.content
        })),
        max_tokens: options.maxTokens,
        temperature: options.temperature,
        stream: false
      };

      const response = await axios({
        method: 'post',
        url: url,
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        data: requestData
      });

      return {
        response: response.data.choices[0].message.content,
        usage: {
          total: response.data.choices[0].message.content.length,
          available: response.data.choices[0].message.content.length,
          reset: 0
        }
      } as any;
    } catch (error) {
      console.error('Error in makeLlama31Request:', error);
      throw error;
    }
  }

  async chat(messages: any, options: any = {}): Promise<any> {
    return await this.makeLlama31Request(messages, options);
  }

  toJSON(): object {
    return {
      name: 'MetaProvider'
    };
  }
}