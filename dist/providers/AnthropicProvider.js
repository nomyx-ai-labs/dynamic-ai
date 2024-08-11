"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const utils_1 = require("../utils/utils");
class AnthropicProvider {
    constructor(config) {
        this.config = config;
    }
    async processRequest(request) {
        const { prompt, maxTokens = 4096, temperature = 0 } = request;
        const messages = [{ role: 'user', content: prompt }];
        return this.makeAnthropicRequest(messages, { max_tokens: maxTokens, temperature });
    }
    async generateResponse(prompt) {
        const response = await this.processRequest({ prompt });
        return response.response;
    }
    async makeAnthropicRequest(messages, options = {
        max_tokens: 4096,
        temperature: 0
    }) {
        try {
            const { stdout: token } = await (0, utils_1.execPromise)('gcloud auth print-access-token');
            const authToken = token.trim();
            const MODEL = this.config.getAnthropicModel();
            const LOCATION = this.config.getAnthropicLocation();
            const PROJECT_ID = this.config.getGcloudProjectId();
            const url = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/anthropic/models/${MODEL}:streamRawPredict`;
            const requestData = {
                anthropic_version: "vertex-2023-10-16",
                messages: messages.map((m) => ({
                    role: m.role,
                    content: [{ type: "text", text: m.content }]
                })),
                max_tokens: options.max_tokens || 4096,
                temperature: options.temperature || 0,
                stream: false
            };
            const response = await (0, axios_1.default)({
                method: 'post',
                url: url,
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json; charset=utf-8'
                },
                data: requestData,
                responseType: 'json'
            });
            return {
                response: response.data.content[0].text,
                usage: {
                    total: response.data.content[0].text.length,
                    available: response.data.content[0].text.length,
                    reset: 0
                }
            };
        }
        catch (error) {
            console.error('Error in makeAnthropicRequest:', error);
            throw error;
        }
    }
    async chat(messages, options = {}) {
        const response = await this.makeAnthropicRequest(messages, options);
        return response;
    }
    toJSON() {
        return { name: 'AnthropicProvider' };
    }
}
exports.default = AnthropicProvider;
//# sourceMappingURL=AnthropicProvider.js.map