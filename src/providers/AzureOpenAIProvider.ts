import { AIProviderType, AIProvider, AIRequest, AIResponse } from '../types';
import { Configuration } from '@nomyx/multi-context-objects';
import axios from 'axios';

export default class AzureOpenAIProvider implements AIProvider {
  private config: Configuration;
  constructor(config: Configuration) {
    this.config = config;
  }
  async processRequest(request: AIRequest): Promise<AIResponse> {
    const { prompt, maxTokens = 2000, temperature = 0 } = request;
    const messages = [{ role: 'user', content: prompt }];
    return this.makeAzureOpenAIRequest(messages, { maxTokens, temperature });
  }

  async generateResponse(prompt: string): Promise<string> {
    const response = await this.processRequest({ prompt });
    return response.response;
  }

  private async makeAzureOpenAIRequest(messages: any[], options = {
    maxTokens: 2000,
    temperature: 0
  }): Promise<AIResponse> {
    try {
      const endpoint = `https://${this.config.getAzureOpenaiEndpoint()}.openai.azure.com`;
      const deploymentId = this.config.getAzureOpenaiDeploymentName();
      const apiVersion = '2024-02-15-preview';
      const apiKey = this.config.getAzureOpenaiApiKey();
      const url = `${endpoint}/openai/deployments/${deploymentId}/chat/completions?api-version=${apiVersion}`;

      const requestData = {
        messages: messages,
        max_tokens: options.maxTokens,
        temperature: options.temperature
      };

      const response = await axios({
        method: 'post',
        url: url,
        headers: {
          'Content-Type': 'application/json',
          'api-key': apiKey
        },
        data: requestData
      });

      return {
        response: response.data.choices[0].message.content,
        usage: response.data.usage
      };
    } catch (error) {
      console.error('Error in makeAzureOpenAIRequest:', error);
      throw error;
    }
  }

  async chat(messages: any, options: any = {}): Promise<any> {
    return await this.makeAzureOpenAIRequest(messages, options);
  }

  toJSON(): object {
    return {
      type: 'AzureOpenAIProvider'
    };
  }
}