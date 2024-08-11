"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DynamicAISystem = void 0;
const multi_context_objects_1 = require("@nomyx/multi-context-objects");
const DecoratorFactory_1 = require("@nomyx/multi-context-objects/src/decorators/DecoratorFactory");
const AIProviderManager_1 = __importDefault(require("./managers/AIProviderManager"));
const PromptManager_1 = __importDefault(require("./managers/PromptManager"));
const ToolManager_1 = __importDefault(require("./managers/ToolManager"));
const multi_context_objects_2 = require("@nomyx/multi-context-objects");
const ActionQueue_1 = require("./ActionQueue");
class DynamicAISystem extends multi_context_objects_1.MultiContextObject {
    constructor(config, dataProvider, networkManager, objectManager) {
        super('dynamic-ai-system', 'system', [multi_context_objects_1.SERVER_CONTEXT, multi_context_objects_1.BROWSER_CONTEXT], dataProvider, networkManager, objectManager);
        this.config = config;
        this.toolManager = new ToolManager_1.default(config, dataProvider, networkManager, objectManager);
        this.promptManager = new PromptManager_1.default(config, dataProvider, networkManager, objectManager, this.toolManager);
        this.cacheManager = new multi_context_objects_1.CacheManager();
        this.retryManager = new multi_context_objects_1.RetryManager();
        this.stateManager = new multi_context_objects_2.StateManager();
        this.actionQueue = new ActionQueue_1.ActionQueue();
        this.aiProviderManager = new AIProviderManager_1.default(config, this.promptManager, this.toolManager, this.stateManager, this.actionQueue);
        this.logger = multi_context_objects_1.Logger.getInstance();
    }
    static async getInstance(config, dataProvider, networkManager, objectManager) {
        if (!DynamicAISystem.instance) {
            DynamicAISystem.instance = new DynamicAISystem(config, dataProvider, networkManager, objectManager);
            await DynamicAISystem.instance.init();
        }
        return DynamicAISystem.instance;
    }
    async init() {
        const currentProvider = this.aiProviderManager.getCurrentProvider();
        await this.promptManager.loadPrompts(currentProvider, this.config.getSharedConfig('promptsPath'));
        await this.toolManager.loadTools(this.config.getSharedConfig('toolsPath'));
        this.logger.info('DynamicAISystem initialized');
    }
    async chat(messages, options = {}) {
        const cacheKey = this.generateCacheKey(messages, options);
        const cachedResponse = this.cacheManager.get(cacheKey);
        if (cachedResponse)
            return cachedResponse;
        const aiProvider = this.aiProviderManager.getCurrentProvider();
        const response = await this.retryManager.retry(() => aiProvider.chat(messages, options));
        this.cacheManager.set(cacheKey, response, 300); // Cache for 5 minutes
        return response;
    }
    async executePrompt(promptName, data, state = {}, options = {}) {
        const prompt = this.promptManager.getPrompt(promptName);
        if (!prompt)
            throw new Error(`Prompt ${promptName} not found`);
        const context = {
            tools: this.toolManager.getToolsSource(),
            prompts: this.promptManager.getPromptSource(),
            ...state
        };
        const messages = [
            { role: 'system', content: this.interpolate(prompt.system, context) },
            { role: 'user', content: this.interpolate(prompt.user, { ...data, ...context }) }
        ];
        const response = await this.chat(messages, { ...prompt.options, ...options });
        return this.processResponse(response, context);
    }
    async executeTool(toolName, params) {
        return this.toolManager.executeTool(toolName, params);
    }
    async processResponse(response, context) {
        try {
            const parsedResponse = multi_context_objects_1.JsonRepair.parseJsonSafely(response);
            if (parsedResponse.actions) {
                for (const action of parsedResponse.actions) {
                    if (await this.toolManager.hasTool(action.type)) {
                        const actionResult = await this.executeTool(action.type, action.data);
                        if (action.echo) {
                            return this.processResponse(JSON.stringify(actionResult), context);
                        }
                    }
                    else if (await this.promptManager.hasPrompt(action.type)) {
                        const promptResult = await this.executePrompt(action.type, action.data, context);
                        if (action.echo) {
                            return this.processResponse(JSON.stringify(promptResult), context);
                        }
                    }
                }
            }
            return parsedResponse;
        }
        catch (error) {
            this.logger.error('Error processing AI response:', error);
            return { error: 'Failed to process AI response', details: error.message };
        }
    }
    interpolate(template, data) {
        return template.replace(/\${(\w+)}|\{(\w+)\}/g, (_, p1, p2) => {
            const key = p1 || p2;
            return data[key] !== undefined ? data[key] : '';
        });
    }
    generateCacheKey(messages, options) {
        return JSON.stringify({ messages, options });
    }
    setAIProvider(provider) {
        this.aiProviderManager.setProvider(provider);
    }
    getAvailableAIProviders() {
        return this.aiProviderManager.getAvailableProviders();
    }
    getCurrentAIProvider() {
        return this.aiProviderManager.getCurrentProvider();
    }
    toJSON() {
        return {
            config: this.config,
            currentProvider: this.aiProviderManager.getCurrentProvider(),
        };
    }
    fromJSON(data) {
        if (data.config) {
            this.config.fromJSON(data.config);
        }
        if (data.currentProvider) {
            this.setAIProvider(data.currentProvider);
        }
    }
}
DynamicAISystem.instance = null;
__decorate([
    (0, DecoratorFactory_1.contextMethod)(multi_context_objects_1.SERVER_CONTEXT),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], DynamicAISystem.prototype, "init", null);
__decorate([
    (0, DecoratorFactory_1.contextMethod)(multi_context_objects_1.SERVER_CONTEXT),
    (0, DecoratorFactory_1.contextMethod)(multi_context_objects_1.BROWSER_CONTEXT),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Array, Object]),
    __metadata("design:returntype", Promise)
], DynamicAISystem.prototype, "chat", null);
__decorate([
    (0, DecoratorFactory_1.contextMethod)(multi_context_objects_1.SERVER_CONTEXT),
    (0, DecoratorFactory_1.contextMethod)(multi_context_objects_1.BROWSER_CONTEXT),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], DynamicAISystem.prototype, "executePrompt", null);
__decorate([
    (0, DecoratorFactory_1.contextMethod)(multi_context_objects_1.SERVER_CONTEXT),
    (0, DecoratorFactory_1.contextMethod)(multi_context_objects_1.BROWSER_CONTEXT),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], DynamicAISystem.prototype, "executeTool", null);
__decorate([
    (0, DecoratorFactory_1.contextMethod)(multi_context_objects_1.SERVER_CONTEXT),
    (0, DecoratorFactory_1.contextMethod)(multi_context_objects_1.BROWSER_CONTEXT),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], DynamicAISystem.prototype, "setAIProvider", null);
__decorate([
    (0, DecoratorFactory_1.contextMethod)(multi_context_objects_1.SERVER_CONTEXT),
    (0, DecoratorFactory_1.contextMethod)(multi_context_objects_1.BROWSER_CONTEXT),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Array)
], DynamicAISystem.prototype, "getAvailableAIProviders", null);
__decorate([
    (0, DecoratorFactory_1.contextMethod)(multi_context_objects_1.SERVER_CONTEXT),
    (0, DecoratorFactory_1.contextMethod)(multi_context_objects_1.BROWSER_CONTEXT),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Object)
], DynamicAISystem.prototype, "getCurrentAIProvider", null);
exports.DynamicAISystem = DynamicAISystem;
exports.default = DynamicAISystem;
//# sourceMappingURL=DynamicAISystem.js.map