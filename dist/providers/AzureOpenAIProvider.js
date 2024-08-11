"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
class AzureOpenAIProvider {
    constructor(config) {
        this.config = config;
    }
    async processRequest(request) {
        const { prompt, maxTokens = 2000, temperature = 0 } = request;
        const messages = [{ role: 'user', content: prompt }];
        return this.makeAzureOpenAIRequest(messages, { maxTokens, temperature });
    }
    async generateResponse(prompt) {
        const response = await this.processRequest({ prompt });
        return response.response;
    }
    async makeAzureOpenAIRequest(messages, options = {
        maxTokens: 2000,
        temperature: 0
    }) {
        try {
            const endpoint = `https://${this.config.getAzureOpenaiEndpoint()}.openai.azure.com`;
            const deploymentId = this.config.getAzureOpenaiDeploymentName();
            const apiVersion = '2024-02-15-preview';
            const apiKey = this.config.getAzureOpenaiApiKey();
            const url = `${endpoint}/openai/deployments/${deploymentId}/chat/completions?api-version=${apiVersion}`;
            const requestData = {
                messages: messages,
                max_tokens: options.maxTokens,
                temperature: options.temperature
            };
            const response = await (0, axios_1.default)({
                method: 'post',
                url: url,
                headers: {
                    'Content-Type': 'application/json',
                    'api-key': apiKey
                },
                data: requestData
            });
            return {
                response: response.data.choices[0].message.content,
                usage: response.data.usage
            };
        }
        catch (error) {
            console.error('Error in makeAzureOpenAIRequest:', error);
            throw error;
        }
    }
    async chat(messages, options = {}) {
        return await this.makeAzureOpenAIRequest(messages, options);
    }
    toJSON() {
        return {
            type: 'AzureOpenAIProvider'
        };
    }
}
exports.default = AzureOpenAIProvider;
//# sourceMappingURL=AzureOpenAIProvider.js.map