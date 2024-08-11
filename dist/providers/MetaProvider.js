"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const utils_1 = require("../utils/utils");
class MetaProvider {
    constructor(config) {
        this.config = config;
    }
    async processRequest(request) {
        const { prompt, maxTokens = 2000, temperature = 0 } = request;
        const messages = [{ role: 'user', content: prompt }];
        return this.makeLlama31Request(messages, { maxTokens, temperature });
    }
    async generateResponse(prompt) {
        const response = await this.processRequest({ prompt });
        return response.response;
    }
    async makeLlama31Request(messages, options = {
        maxTokens: 2000,
        temperature: 0
    }) {
        try {
            const { stdout: token } = await (0, utils_1.execPromise)('gcloud auth print-access-token');
            const authToken = token.trim();
            const ENDPOINT = this.config.getLlamaEndpoint() || 'us-central1-aiplatform.googleapis.com';
            const PROJECT_ID = this.config.getGcloudProjectId();
            const REGION = this.config.getGcloudRegion() || 'us-central1';
            const url = `https://${ENDPOINT}/v1beta1/projects/${PROJECT_ID}/locations/${REGION}/endpoints/openapi/chat/completions`;
            const requestData = {
                model: "meta/llama3-405b-instruct-maas",
                messages: messages.map((m) => ({
                    role: m.role,
                    content: m.content
                })),
                max_tokens: options.maxTokens,
                temperature: options.temperature,
                stream: false
            };
            const response = await (0, axios_1.default)({
                method: 'post',
                url: url,
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                data: requestData
            });
            return {
                response: response.data.choices[0].message.content,
                usage: {
                    total: response.data.choices[0].message.content.length,
                    available: response.data.choices[0].message.content.length,
                    reset: 0
                }
            };
        }
        catch (error) {
            console.error('Error in makeLlama31Request:', error);
            throw error;
        }
    }
    async chat(messages, options = {}) {
        return await this.makeLlama31Request(messages, options);
    }
    toJSON() {
        return {
            name: 'MetaProvider'
        };
    }
}
exports.default = MetaProvider;
//# sourceMappingURL=MetaProvider.js.map