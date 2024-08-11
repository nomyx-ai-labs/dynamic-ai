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
Object.defineProperty(exports, "__esModule", { value: true });
const multi_context_objects_1 = require("@nomyx/multi-context-objects");
const contextMethod = multi_context_objects_1.DecoratorFactory.contextMethod;
const [SERVER_CONTEXT, BROWSER_CONTEXT] = multi_context_objects_1.contexts;
class ToolManager extends multi_context_objects_1.MultiContextObject {
    constructor(config, provider, networkManager, objectManager) {
        super('tool-manager', 'component', [SERVER_CONTEXT, BROWSER_CONTEXT], provider, networkManager, objectManager);
        this.config = config;
        this.provider = provider;
        this.networkManager = networkManager;
        this.objectManager = objectManager;
        this.tools = new Map();
    }
    async init() {
        const toolsPath = this.config.getSharedConfig('toolsPath') || 'tools.json';
        await this.loadTools(toolsPath);
    }
    async loadTools(toolsPath) {
        const fs = require('fs');
        const path = require('path');
        try {
            let ppath = path.join(__dirname, toolsPath);
            const files = fs.readdirSync(ppath);
            files.forEach((file) => {
                if (!file.endsWith('.json'))
                    return;
                const toolSource = JSON.parse(fs.readFileSync(path.join(ppath, file), 'utf8'));
                const tools = toolSource.reduce((acc, prompt) => {
                    const pName = Object.keys(prompt)[0];
                    acc[pName] = prompt[pName];
                    return acc;
                }, {});
                this.tools = new Map([...this.tools, ...tools]);
            });
        }
        catch (error) {
            console.error('Error loading prompts:', error);
            throw error;
        }
    }
    addTool(toolName, tool) {
        this.tools.set(toolName, tool);
    }
    async executeTool(toolName, params) {
        const tool = this.tools.get(toolName);
        if (!tool)
            throw new Error(`Tool ${toolName} not found`);
        return tool.exec(params);
    }
    async hasTool(toolName) {
        return this.tools.has(toolName);
    }
    getToolsSource() {
        return Array.from(this.tools.entries()).map(([name, tool]) => ({
            [name]: {
                type: tool.type,
                schema: tool.schema,
            }
        }));
    }
    async updateFromConfig(configuration) {
        const toolsPath = configuration.getSharedConfig('toolsPath') || 'tools.json';
        await this.loadTools(toolsPath);
    }
    toJSON() {
        return { tools: Array.from(this.tools.entries()) };
    }
    fromJSON(data) {
        this.tools = new Map(data.tools);
    }
}
__decorate([
    contextMethod(SERVER_CONTEXT),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ToolManager.prototype, "init", null);
__decorate([
    contextMethod(SERVER_CONTEXT),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ToolManager.prototype, "loadTools", null);
__decorate([
    contextMethod(SERVER_CONTEXT),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], ToolManager.prototype, "addTool", null);
__decorate([
    contextMethod(SERVER_CONTEXT),
    contextMethod(BROWSER_CONTEXT),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ToolManager.prototype, "executeTool", null);
__decorate([
    contextMethod(SERVER_CONTEXT),
    contextMethod(BROWSER_CONTEXT),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ToolManager.prototype, "hasTool", null);
__decorate([
    contextMethod(SERVER_CONTEXT),
    contextMethod(BROWSER_CONTEXT),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Array)
], ToolManager.prototype, "getToolsSource", null);
__decorate([
    contextMethod(SERVER_CONTEXT),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [multi_context_objects_1.Configuration]),
    __metadata("design:returntype", Promise)
], ToolManager.prototype, "updateFromConfig", null);
exports.default = ToolManager;
//# sourceMappingURL=ToolManager.js.map