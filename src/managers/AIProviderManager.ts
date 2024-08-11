

import { Configuration, StateManager } from '@nomyx/multi-context-objects';
import { AIExecutionPipeline } from '../AIExecutionPipeline';

import { AIProviderType, AIProvider, AIResponse, AIRequest } from '../types';
import AnthropicProvider from '../providers/AnthropicProvider';
import AzureOpenAIProvider from '../providers/AzureOpenAIProvider';
import MetaProvider from '../providers/MetaProvider';
import VertexProvider from '../providers/VertexProvider';
import PromptManager from './PromptManager';
import ToolManager from './ToolManager';
import { ActionQueue } from '../ActionQueue';

export default class AIProviderManager {
    private providers: Map<AIProviderType, AIProvider>;
    private currentProvider: AIProviderType;
    private executionPipeline: AIExecutionPipeline;

    constructor(
        private configuration: Configuration,
        private promptManager: PromptManager,
        private toolManager: ToolManager,
        private stateManager: StateManager,
        private actionQueue: ActionQueue
    ) {
        this.providers = new Map();
        this.currentProvider = this.configuration.getAiProvider() as AIProviderType;
        this.initializeProviders();
        this.executionPipeline = new AIExecutionPipeline(
            this.promptManager,
            this.toolManager,
            this.stateManager,
            this.actionQueue as any
        );
    }

    static newInstance(configuration: Configuration, promptManager: PromptManager, toolManager: ToolManager, stateManager: StateManager, actionQueue: ActionQueue): AIProviderManager {
        return new AIProviderManager(configuration, promptManager, toolManager, stateManager, actionQueue);
    }

    private initializeProviders(): void {
        this.providers.set('anthropic', new AnthropicProvider(this.configuration));
        this.providers.set('vertex', new VertexProvider(this.configuration));
        this.providers.set('openai', new AzureOpenAIProvider(this.configuration));
        this.providers.set('meta', new MetaProvider(this.configuration));
    }

    setProvider(providerType: AIProviderType): void {
        if (!this.providers.has(providerType)) {
            throw new Error(`AI provider ${providerType} is not supported`);
        }
        this.currentProvider = providerType;
        this.configuration.setAiProvider(providerType);
    }

    getCurrentProvider(): AIProvider {
        const provider = this.providers.get(this.currentProvider);
        if (!provider) {
            throw new Error(`Current AI provider ${this.currentProvider} is not initialized`);
        }
        return provider;
    }

    getAvailableProviders(): AIProviderType[] {
        return Array.from(this.providers.keys());
    }
    
    getProvider(providerType: AIProviderType): AIProvider {
        const provider = this.providers.get(providerType);
        if (!provider) {
            throw new Error(`AI provider ${providerType} is not supported`);
        }
        return provider;
    }

    async execute(prompt: string, params: any = {}, options: any = {}): Promise<AIResponse> {
        const provider = this.getCurrentProvider();
        const executionResult = await this.executionPipeline.execute(prompt, { ...params, provider }, options);
        
        return {
            response: executionResult.state.response || '',
            usage: executionResult.state.usage || { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
        };
    }

    async chat(messages: any, options: any = {}): Promise<AIResponse> {
        return this.execute(messages.map((m: any) => m.content).join('\n'), {}, options || {});
    }

    async processRequest(request: AIRequest): Promise<AIResponse> {
        return this.execute(request.prompt, request, {
            maxTokens: request.maxTokens,
            temperature: request.temperature
        });
    }

    async generateResponse(prompt: string): Promise<string> {
        const response = await this.execute(prompt);
        return response.response;
    }

    updateFromConfig(): void {
        const configProvider = this.configuration.getAiProvider() as AIProviderType;
        if (configProvider !== this.currentProvider) {
            this.setProvider(configProvider);
        }
        this.promptManager.updateFromConfig(this.configuration);
        this.toolManager.updateFromConfig(this.configuration);
    }

    toJSON(): object {
        return {
            currentProvider: this.currentProvider,
            providers: Array.from(this.providers.keys()),
            promptManager: this.promptManager.toJSON(),
            toolManager: this.toolManager.toJSON()
        };
    }

    fromJSON(json: any, configuration: Configuration, promptManager: PromptManager, toolManager: ToolManager, stateManager: StateManager, actionQueue: ActionQueue): AIProviderManager {
        const manager = new AIProviderManager(configuration, promptManager, toolManager, stateManager, actionQueue);
        manager.setProvider(json.currentProvider);
        return manager;
    }
}