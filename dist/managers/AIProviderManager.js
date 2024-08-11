"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const AIExecutionPipeline_1 = require("../AIExecutionPipeline");
const AnthropicProvider_1 = __importDefault(require("../providers/AnthropicProvider"));
const AzureOpenAIProvider_1 = __importDefault(require("../providers/AzureOpenAIProvider"));
const MetaProvider_1 = __importDefault(require("../providers/MetaProvider"));
const VertexProvider_1 = __importDefault(require("../providers/VertexProvider"));
class AIProviderManager {
    constructor(configuration, promptManager, toolManager, stateManager, actionQueue) {
        this.configuration = configuration;
        this.promptManager = promptManager;
        this.toolManager = toolManager;
        this.stateManager = stateManager;
        this.actionQueue = actionQueue;
        this.providers = new Map();
        this.currentProvider = this.configuration.getAiProvider();
        this.initializeProviders();
        this.executionPipeline = new AIExecutionPipeline_1.AIExecutionPipeline(this.promptManager, this.toolManager, this.stateManager, this.actionQueue);
    }
    static newInstance(configuration, promptManager, toolManager, stateManager, actionQueue) {
        return new AIProviderManager(configuration, promptManager, toolManager, stateManager, actionQueue);
    }
    initializeProviders() {
        this.providers.set('anthropic', new AnthropicProvider_1.default(this.configuration));
        this.providers.set('vertex', new VertexProvider_1.default(this.configuration));
        this.providers.set('openai', new AzureOpenAIProvider_1.default(this.configuration));
        this.providers.set('meta', new MetaProvider_1.default(this.configuration));
    }
    setProvider(providerType) {
        if (!this.providers.has(providerType)) {
            throw new Error(`AI provider ${providerType} is not supported`);
        }
        this.currentProvider = providerType;
        this.configuration.setAiProvider(providerType);
    }
    getCurrentProvider() {
        const provider = this.providers.get(this.currentProvider);
        if (!provider) {
            throw new Error(`Current AI provider ${this.currentProvider} is not initialized`);
        }
        return provider;
    }
    getAvailableProviders() {
        return Array.from(this.providers.keys());
    }
    getProvider(providerType) {
        const provider = this.providers.get(providerType);
        if (!provider) {
            throw new Error(`AI provider ${providerType} is not supported`);
        }
        return provider;
    }
    async execute(prompt, params = {}, options = {}) {
        const provider = this.getCurrentProvider();
        const executionResult = await this.executionPipeline.execute(prompt, { ...params, provider }, options);
        return {
            response: executionResult.state.response || '',
            usage: executionResult.state.usage || { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
        };
    }
    async chat(messages, options = {}) {
        return this.execute(messages.map((m) => m.content).join('\n'), {}, options || {});
    }
    async processRequest(request) {
        return this.execute(request.prompt, request, {
            maxTokens: request.maxTokens,
            temperature: request.temperature
        });
    }
    async generateResponse(prompt) {
        const response = await this.execute(prompt);
        return response.response;
    }
    updateFromConfig() {
        const configProvider = this.configuration.getAiProvider();
        if (configProvider !== this.currentProvider) {
            this.setProvider(configProvider);
        }
        this.promptManager.updateFromConfig(this.configuration);
        this.toolManager.updateFromConfig(this.configuration);
    }
    toJSON() {
        return {
            currentProvider: this.currentProvider,
            providers: Array.from(this.providers.keys()),
            promptManager: this.promptManager.toJSON(),
            toolManager: this.toolManager.toJSON()
        };
    }
    fromJSON(json, configuration, promptManager, toolManager, stateManager, actionQueue) {
        const manager = new AIProviderManager(configuration, promptManager, toolManager, stateManager, actionQueue);
        manager.setProvider(json.currentProvider);
        return manager;
    }
}
exports.default = AIProviderManager;
//# sourceMappingURL=AIProviderManager.js.map