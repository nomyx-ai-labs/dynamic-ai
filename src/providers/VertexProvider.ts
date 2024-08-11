import { AIProviderType, AIProvider, AIRequest, AIResponse } from '../types';
import axios from 'axios';
import { Configuration } from '@nomyx/multi-context-objects';
import { execPromise } from '../utils/utils';

export default class VertexProvider implements AIProvider {
  private config: Configuration;
  constructor(config: Configuration) {
    this.config = config;
  }
  async processRequest(request: AIRequest): Promise<AIResponse> {
    const { prompt, maxTokens = 2000, temperature = 0 } = request;
    const messages = [{ role: 'user', content: prompt }];
    return this.makeGeminiRequest(messages, { maxTokens, temperature });
  }

  async generateResponse(prompt: string): Promise<string> {
    const response = await this.processRequest({ prompt });
    return response.response;
  }

  private async makeGeminiRequest(messages: any[], options = {
    maxTokens: 2000,
    temperature: 0,
  }): Promise<AIResponse> {
    try {
      const { stdout: token } = await execPromise('gcloud auth print-access-token');
      const authToken = token.trim();
      const API_ENDPOINT = "us-central1-aiplatform.googleapis.com";
      const url = `https://us-central1-aiplatform.googleapis.com/v1/projects/${this.config.getGcloudProjectId()}/locations/us-central1/publishers/google/models/${this.config.getVertexModel()}:generateContent`;

      const content = messages.reduce((acc: string, m: any) => acc + m.content + '\n', '');

      const requestData = {
        contents: [{
          role: "user",
          parts: [{ text: content }]
        }],
        generationConfig: {
          maxOutputTokens: options.maxTokens,
          temperature: options.temperature,
          topP: 0.95,
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "BLOCK_ONLY_HIGH",
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_ONLY_HIGH",
          },
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_ONLY_HIGH",
          },
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_ONLY_HIGH",
          }
        ],
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
        response: response.data.candidates[0].content.parts[0].text,
        usage: {
          total: response.data.candidates[0].content.parts[0].text.length,
          available: 1000000,
          reset: 0
        }
      } as any;
    } catch (error) {
      console.error('Error in makeGeminiRequest:', error);
      throw error;
    }
  }

  async chat(messages: any, options: any = {}): Promise<any> {
    return await this.makeGeminiRequest(messages, options);
  }

  toJSON() {
    return {
      type: 'VertexProvider',
    };
  }
}