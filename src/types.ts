
export interface AIProvider {
  processRequest(request: AIRequest): Promise<AIResponse>;
  generateResponse(prompt: string): Promise<string>;
  chat(messages: any, options: any): Promise<any>;
}

export type AIProviderType = 'anthropic' | 'vertex' | 'openai' | 'meta';

export interface AIRequest {
  prompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AIResponse {
  response: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}
