import { MultiContextObject, CacheManager, RetryManager, Logger, Configuration, SERVER_CONTEXT, BROWSER_CONTEXT, JsonRepair, DataProvider, NetworkManager, ObjectManager } from "@nomyx/multi-context-objects";
import { contextMethod } from "@nomyx/multi-context-objects/src/decorators/DecoratorFactory";
import AIProviderManager from "./managers/AIProviderManager";
import PromptManager from "./managers/PromptManager";
import ToolManager from "./managers/ToolManager";
import { StateManager } from "@nomyx/multi-context-objects";
import { ActionQueue } from "./ActionQueue";



export class DynamicAISystem extends MultiContextObject {
    private static instance: DynamicAISystem | null = null;
    private aiProviderManager: AIProviderManager;
    private promptManager: PromptManager;
    private toolManager: ToolManager;
    private cacheManager: CacheManager;
    private retryManager: RetryManager;
    private stateManager: StateManager
    private actionQueue: ActionQueue;
    private logger: Logger;

    private constructor(private config: Configuration, dataProvider: DataProvider, networkManager: NetworkManager, objectManager: ObjectManager) {
        super('dynamic-ai-system', 'system', [SERVER_CONTEXT, BROWSER_CONTEXT], dataProvider, networkManager, objectManager);
        this.toolManager = new ToolManager(config, dataProvider, networkManager, objectManager);
        this.promptManager = new PromptManager(config, dataProvider, networkManager, objectManager, this.toolManager);
        this.cacheManager = new CacheManager();
        this.retryManager = new RetryManager();
        this.stateManager = new StateManager();
        this.actionQueue = new ActionQueue();
        this.aiProviderManager = new AIProviderManager(config, this.promptManager, this.toolManager, this.stateManager, this.actionQueue);
        this.logger = Logger.getInstance();
    }

    public static async getInstance(config: Configuration, dataProvider: DataProvider, networkManager: NetworkManager, objectManager: ObjectManager): Promise<DynamicAISystem> {
        if (!DynamicAISystem.instance) {
            DynamicAISystem.instance = new DynamicAISystem(config, dataProvider, networkManager, objectManager);
            await DynamicAISystem.instance.init();
        }
        return DynamicAISystem.instance;
    }

    @contextMethod(SERVER_CONTEXT)
    public async init(): Promise<void> {
        const currentProvider = this.aiProviderManager.getCurrentProvider();
        await this.promptManager.loadPrompts(currentProvider, this.config.getSharedConfig('promptsPath'));
        await this.toolManager.loadTools(this.config.getSharedConfig('toolsPath'));
        this.logger.info('DynamicAISystem initialized');
    }

    @contextMethod(SERVER_CONTEXT)
    @contextMethod(BROWSER_CONTEXT)
    public async chat(messages: any[], options: any = {}): Promise<string> {
        const cacheKey = this.generateCacheKey(messages, options);
        const cachedResponse = this.cacheManager.get<string>(cacheKey);
        if (cachedResponse) return cachedResponse;

        const aiProvider = this.aiProviderManager.getCurrentProvider();
        const response = await this.retryManager.retry(() => aiProvider.chat(messages, options));

        this.cacheManager.set(cacheKey, response, 300); // Cache for 5 minutes
        return response;
    }

    @contextMethod(SERVER_CONTEXT)
    @contextMethod(BROWSER_CONTEXT)
    public async executePrompt(promptName: string, data: any, state: any = {}, options: any = {}): Promise<any> {
        const prompt = this.promptManager.getPrompt(promptName);
        if (!prompt) throw new Error(`Prompt ${promptName} not found`);

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

    @contextMethod(SERVER_CONTEXT)
    @contextMethod(BROWSER_CONTEXT)
    public async executeTool(toolName: string, params: any): Promise<any> {
        return this.toolManager.executeTool(toolName, params);
    }

    private async processResponse(response: string, context: any): Promise<any> {
        try {
            const parsedResponse = JsonRepair.parseJsonSafely(response);
            if (parsedResponse.actions) {
                for (const action of parsedResponse.actions) {
                    if (await this.toolManager.hasTool(action.type)) {
                        const actionResult = await this.executeTool(action.type, action.data);
                        if (action.echo) {
                            return this.processResponse(JSON.stringify(actionResult), context);
                        }
                    } else if (await this.promptManager.hasPrompt(action.type)) {
                        const promptResult = await this.executePrompt(action.type, action.data, context);
                        if (action.echo) {
                            return this.processResponse(JSON.stringify(promptResult), context);
                        }
                    }
                }
            }
            return parsedResponse;
        } catch (error: any) {
            this.logger.error('Error processing AI response:', error);
            return { error: 'Failed to process AI response', details: error.message };
        }
    }

    private interpolate(template: string, data: any): string {
        return template.replace(/\${(\w+)}|\{(\w+)\}/g, (_, p1, p2) => {
            const key = p1 || p2;
            return data[key] !== undefined ? data[key] : '';
        });
    }

    private generateCacheKey(messages: any[], options: any): string {
        return JSON.stringify({ messages, options });
    }

    @contextMethod(SERVER_CONTEXT)
    @contextMethod(BROWSER_CONTEXT)
    public setAIProvider(provider: any): void {
        this.aiProviderManager.setProvider(provider);
    }

    @contextMethod(SERVER_CONTEXT)
    @contextMethod(BROWSER_CONTEXT)
    public getAvailableAIProviders(): string[] {
        return this.aiProviderManager.getAvailableProviders();
    }

    @contextMethod(SERVER_CONTEXT)
    @contextMethod(BROWSER_CONTEXT)
    public getCurrentAIProvider(): any {
        return this.aiProviderManager.getCurrentProvider();
    }

    public toJSON(): object {
        return {
            config: this.config,
            currentProvider: this.aiProviderManager.getCurrentProvider(),
        };
    }

    public fromJSON(data: any): void {
        if (data.config) {
            this.config.fromJSON(data.config);
        }
        if (data.currentProvider) {
            this.setAIProvider(data.currentProvider);
        }
    }
}

export default DynamicAISystem;