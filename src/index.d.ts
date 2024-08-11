import { Configuration, MultiContextObject, StateManager } from "@nomyx/multi-context-objects";

import { AIProvider, AIProviderType, AIRequest, AIResponse } from "./types";

import { ActionQueue } from "./ActionQueue";

declare module '@nomyx/dynamic-ai' {

  export { AIProvider, AIProviderType, AIRequest, AIResponse, ActionQueue };

  export class AIProviderManager {
    constructor(configuration: Configuration, promptManager: PromptManager, toolManager: ToolManager, stateManager: StateManager, actionQueue: ActionQueue);
    static newInstance(configuration: Configuration, promptManager: PromptManager, toolManager: ToolManager, stateManager: StateManager, actionQueue: ActionQueue): AIProviderManager;
    setProvider(providerType: AIProviderType): void;
    getCurrentProvider(): AIProvider;
    getProvider(providerType: AIProviderType): AIProvider;
    execute(prompt: string, params?: any, options?: any): Promise<AIResponse>;
    chat(messages: any, options?: any): Promise<AIResponse>;
    processRequest(request: AIRequest): Promise<AIResponse>;
    generateResponse(prompt: string): Promise<string>;
    updateFromConfig(): void;
    toJSON(): object;
    fromJSON(data: any, configuration: Configuration, promptManager: PromptManager, toolManager: ToolManager, stateManager: StateManager, actionQueue: ActionQueue): AIProviderManager;
  }

  export class PromptManager extends MultiContextObject {
    constructor(config: Configuration, dataProvider: any, networkManager: any, objectManager: any, toolManager: ToolManager);
    init(aiProvider: AIProvider): Promise<void>;
    loadPrompts(aiProvider: AIProvider, promptsPath: string): Promise<void>;
    executePrompt(promptName: string, data: any, state?: any, options?: any): Promise<any>;
    updateFromConfig(configuration: Configuration): Promise<void>;
    getAvailableProviders(): any[];
    getPrompt(promptName: string): any;
    hasPrompt(promptName: string): boolean;
    getPromptSource(): any[];
    toJSON(): object;
    fromJSON(data: any): void;
  }

  export class ToolManager extends MultiContextObject {
    constructor(config: Configuration, provider: any, networkManager: any, objectManager: any);
    init(): Promise<void>;
    loadTools(toolsPath: string): Promise<void>;
    executeTool(toolName: string, params: any): Promise<any>;
    hasTool(toolName: string): Promise<boolean>;
    getToolsSource(): any[];
    updateFromConfig(configuration: Configuration): Promise<void>;
    toJSON(): object;
    fromJSON(data: any): void;
  }

  export class DynamicAISystem extends MultiContextObject {
    constructor(config: Configuration, dataProvider: any, networkManager: any, objectManager: any);
    static getInstance(config: Configuration, dataProvider: any, networkManager: any, objectManager: any): Promise<DynamicAISystem>;
    init(): Promise<void>;
    chat(messages: any[], options?: any): Promise<string>;
    executePrompt(promptName: string, data: any, state?: any, options?: any): Promise<any>;
    executeTool(toolName: string, params: any): Promise<any>;
    setAIProvider(provider: any): void;
    getAvailableAIProviders(): string[];
    getCurrentAIProvider(): any;
    toJSON(): object;
    fromJSON(data: any): void;
  }

}