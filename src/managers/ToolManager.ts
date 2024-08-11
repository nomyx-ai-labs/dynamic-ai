import { Configuration, DecoratorFactory, MultiContextObject, contexts } from '@nomyx/multi-context-objects';

const contextMethod = DecoratorFactory.contextMethod;
const [ SERVER_CONTEXT, BROWSER_CONTEXT ] = contexts;

export default class ToolManager extends MultiContextObject {
    private tools: Map<string, any> = new Map();

    constructor(private config: Configuration, public provider: any, public networkManager: any, public objectManager: any) {
        super('tool-manager', 'component', [SERVER_CONTEXT, BROWSER_CONTEXT], provider, networkManager, objectManager);
    }

    @contextMethod(SERVER_CONTEXT)
    async init() {
        const toolsPath = this.config.getSharedConfig('toolsPath') || 'tools.json';
        await this.loadTools(toolsPath);
    }

    @contextMethod(SERVER_CONTEXT)
    public async loadTools(toolsPath: string) {
        const fs = require('fs');
        const path = require('path');
        try {
            let ppath = path.join(__dirname, toolsPath);
            const files = fs.readdirSync(ppath);
            files.forEach((file: any) => {
                if (!file.endsWith('.json')) return;
                const toolSource = JSON.parse(fs.readFileSync(path.join(ppath, file), 'utf8'));
                const tools = toolSource.reduce((acc: any, prompt: any) => {
                    const pName = Object.keys(prompt)[0];
                    acc[pName] = prompt[pName];
                    return acc;
                }, {});
                this.tools = new Map([...this.tools, ...tools]);
            });
        } catch (error) {
            console.error('Error loading prompts:', error);
            throw error;
        }
    }

    @contextMethod(SERVER_CONTEXT)
    addTool(toolName: string, tool: any) {
        this.tools.set(toolName, tool);
    }

    @contextMethod(SERVER_CONTEXT)
    @contextMethod(BROWSER_CONTEXT as any)
    async executeTool(toolName: string, params: any) {
        const tool = this.tools.get(toolName);
        if (!tool) throw new Error(`Tool ${toolName} not found`);
        return tool.exec(params);
    }

    @contextMethod(SERVER_CONTEXT)
    @contextMethod(BROWSER_CONTEXT as any)
    async hasTool(toolName: string): Promise<boolean> {
        return this.tools.has(toolName);
    }

    @contextMethod(SERVER_CONTEXT)
    @contextMethod(BROWSER_CONTEXT as any)
    getToolsSource(): any[] {
        return Array.from(this.tools.entries()).map(([name, tool]) => ({
            [name]: {
                type: tool.type,
                schema: tool.schema,
            }
        }));
    }

    @contextMethod(SERVER_CONTEXT)
    async updateFromConfig(configuration: Configuration): Promise<void> {
        const toolsPath = configuration.getSharedConfig('toolsPath') || 'tools.json';
        await this.loadTools(toolsPath);
    }

    toJSON(): object {
        return { tools: Array.from(this.tools.entries()) };
    }

    fromJSON(data: any): void {
        this.tools = new Map(data.tools);
    }
}