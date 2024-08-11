import { MultiContextObject, DecoratorFactory, Configuration, contexts, JsonRepair } from "@nomyx/multi-context-objects";
import ToolManager from '../managers/ToolManager';
import { AIProvider } from '../types';

const { contextMethod } = DecoratorFactory;
const [ SERVER_CONTEXT, BROWSER_CONTEXT ] = contexts;

export default class PromptManager extends MultiContextObject {
    private prompts: Map<string, any> = new Map();
    private promptSource: any[] = [];

    constructor(
        private config: Configuration,
        private dataProvider: any,
        public networkManager: any,
        public objectManager: any,
        private toolManager: ToolManager
    ) {
        super('prompt-manager', 'component', [SERVER_CONTEXT, BROWSER_CONTEXT], dataProvider, networkManager, objectManager);
    }

    @contextMethod(SERVER_CONTEXT)
    async init(aiProvider: AIProvider) {
        const promptsPath = this.config.getSharedConfig('promptsPath') || 'prompts.json';
        await this.loadPrompts(aiProvider, promptsPath);
    }

    @contextMethod(SERVER_CONTEXT)
    public async loadPrompts(aiProvider: AIProvider, promptsPath: string) {
        const fs = require('fs');
        const path = require('path');
        try {
            let ppath = path.join(__dirname, promptsPath);
            const files = fs.readdirSync(ppath);
            files.forEach((file: any) => {
                if (!file.endsWith('.json')) return;
                const promptSource = JSON.parse(fs.readFileSync(path.join(ppath, file), 'utf8'));
                const prompts = promptSource.reduce((acc: any, prompt: any) => {
                    const pName = Object.keys(prompt)[0];
                    acc[pName] = prompt[pName];
                    acc[pName].exec = this.createDynamicPromptExecutor(aiProvider, prompt[pName]);
                    return acc;
                }, {});
                this.prompts = { ...this.prompts, ...prompts };
            });
            console.log(`Prompts loaded: ${Object.keys(this.prompts).join(', ')}`);
        } catch (error) {
            console.error('Error loading prompts:', error);
            throw error;
        }
    }

    @contextMethod(SERVER_CONTEXT)
    @contextMethod(BROWSER_CONTEXT as any)
    async executePrompt(promptName: string, data: any, state: any = {}, options: any = {}) {
        const prompt = this.prompts.get(promptName);
        if (!prompt) throw new Error(`Prompt ${promptName} not found`);
        return prompt.exec(data, state, options);
    }

    @contextMethod(SERVER_CONTEXT)
    async updateFromConfig(configuration: Configuration) {
        this.config = configuration;
    }

    private createDynamicPromptExecutor(aiProvider: AIProvider, promptTemplate: any) {
        if (!promptTemplate) return;
        return async (requestObject: any, state = {}, userOptions: any = {}) => {
            console.log('Executing prompt:', promptTemplate);
            if (promptTemplate.requestFormat) {
                for (const [key, type] of Object.entries(promptTemplate.requestFormat)) {
                    if (Array.isArray(type)) {
                        if (!type.includes(typeof requestObject[key])) {
                            throw new Error(`Invalid request format: ${key} should be one of types ${type.join(', ')} but is ${typeof requestObject[key]}`);
                        }
                    } else if (typeof requestObject[key] !== type) {
                        //throw new Error(`Invalid request format: ${key} should be of type ${type} but is ${typeof requestObject[key]}`);
                        console.warn(`Invalid request format: ${key} should be of type ${type} but is ${typeof requestObject[key]}`);
                    }
                }
            }
            const messages = [
                {
                    role: 'system',
                    content: JSON.stringify({
                        system: "You are an advanced assistant capable of performing a wide variety of tasks. Use the available tools and prompts to perform the task given to you. Return a chat response to the user in `chatResponse` along with any actions you want to take in `actions`. Chain actions together by using the runPromptInClient action.",
                        response_format: {
                            type: "json_object",
                            format: "To execute command, respond with an object with format: { \"actions\": [{ \"type\": \"<tool or prompt name>\", \"data\": { \"command\": \"your_command_here\" } }] }",
                            options: ["JSON_OUTPUT_ONLY", "SYNTACTICALLY_CORRECT_JSON", "DISABLE_NEWLINES", "DISABLE_WHITESPACE", "VALIDATE_JSON"]
                        },
                        prompts: this.promptSource,
                        tools: this.toolManager.getToolsSource(),
                        actions: ['To use a tool or a prompt, add an actions parameter to your response containing an array of action objects. Action objects have the format { name: "<tool or prompt name>", data: { key: value } }.',
                            'Prompts can be run both server-server and client-side in the browser. To chain prompts together, return a prompt action set to run in the client using the `runPromptInClient` action.'
                        ]
                    }),
                },
                {
                    role: 'user',
                    content: JSON.stringify({
                        user: this.interpolate(promptTemplate.user, requestObject),
                        response_format: {
                            type: "json_object",
                            options: ["JSON_OUTPUT_ONLY", "SYNTACTICALLY_CORRECT_JSON", "DISABLE_NEWLINES", "DISABLE_WHITESPACE", "VALIDATE_JSON"]
                        },
                        state
                    }),
                },
            ]
            const options = { ...promptTemplate.options, ...userOptions };
            const call = async (msgs: any): Promise<any> => {
                const response = await aiProvider.chat(msgs, {
                    source: userOptions.source || this.config.getSharedConfig('AI_PROVIDER') || 'anthropic',
                    temperature: userOptions.temperature || 0,
                    max_tokens: userOptions.maxTokens || 4000
                });
                try {
                    let result = response;
                    if (typeof response === 'string') {
                        result = JsonRepair.parseJsonSafely(response);
                    }
                    msgs.push({ role: 'assistant', content: JSON.stringify(result || response || '...') });
                    if (result.actions) {
                        for (const action of result.actions) {
                            if (await this.toolManager.hasTool(action.type)) {
                                const actionResult = await this.toolManager.executeTool(action.type, action.data);
                                if (action.echo) {
                                    msgs.push({ role: 'user', content: JSON.stringify(actionResult) });
                                    return call(msgs);
                                }
                            } else if (this.prompts.has(action.type)) {
                                const prompt = this.prompts.get(action.type);
                                const promptResult = await prompt.exec(action.data, {
                                    ...state,
                                    chatResponse: response,
                                    tools: this.toolManager.getToolsSource(),
                                });
                                if (action.echo) {
                                    msgs.push({ role: 'user', content: JSON.stringify(promptResult) });
                                    return call(msgs);
                                }
                            }
                        }
                    }
                    return result;
                } catch (e) {
                    console.error('Error in prompt execution:', e);
                    return { chatResponse: response };
                }
            };

            return call(messages);
        };
    }

    getAvailableProviders() {
        return this.promptSource;
    }
    
    getPrompt(promptName: string) {
        return this.prompts.get(promptName);
    }

    hasPrompt(promptName: string) {
        return this.prompts.has(promptName);
    }

    getPromptSource() {
        return this.promptSource;
    }

    private interpolate(template: string, data: any): string {
        return template.replace(/\${(\w+)}|\{(\w+)\}/g, (_, p1, p2) => {
            const key = p1 || p2;
            return data[key] !== undefined ? data[key] : '';
        });
    }

    toJSON(): object {
        return { prompts: Array.from(this.prompts.entries()) };
    }

    fromJSON(data: any): void {
        this.prompts = new Map(data.prompts);
    }
}