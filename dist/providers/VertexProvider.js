"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const utils_1 = require("../utils/utils");
class VertexProvider {
    constructor(config) {
        this.config = config;
    }
    async processRequest(request) {
        const { prompt, maxTokens = 2000, temperature = 0 } = request;
        const messages = [{ role: 'user', content: prompt }];
        return this.makeGeminiRequest(messages, { maxTokens, temperature });
    }
    async generateResponse(prompt) {
        const response = await this.processRequest({ prompt });
        return response.response;
    }
    async makeGeminiRequest(messages, options = {
        maxTokens: 2000,
        temperature: 0,
    }) {
        try {
            const { stdout: token } = await (0, utils_1.execPromise)('gcloud auth print-access-token');
            const authToken = token.trim();
            const API_ENDPOINT = "us-central1-aiplatform.googleapis.com";
            const url = `https://us-central1-aiplatform.googleapis.com/v1/projects/${this.config.getGcloudProjectId()}/locations/us-central1/publishers/google/models/${this.config.getVertexModel()}:generateContent`;
            const content = messages.reduce((acc, m) => acc + m.content + '\n', '');
            const requestData = {
                contents: [{
                        role: "user",
                        parts: [{ text: content }]
                    }],
                generationConfig: {
                    maxOutputTokens: options.maxTokens,
                    temperature: options.temperature,
                    topP: 0.95,
                },
                safetySettings: [
                    {
                        category: "HARM_CATEGORY_HATE_SPEECH",
                        threshold: "BLOCK_ONLY_HIGH",
                    },
                    {
                        category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                        threshold: "BLOCK_ONLY_HIGH",
                    },
                    {
                        category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                        threshold: "BLOCK_ONLY_HIGH",
                    },
                    {
                        category: "HARM_CATEGORY_HARASSMENT",
                        threshold: "BLOCK_ONLY_HIGH",
                    }
                ],
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
                response: response.data.candidates[0].content.parts[0].text,
                usage: {
                    total: response.data.candidates[0].content.parts[0].text.length,
                    available: 1000000,
                    reset: 0
                }
            };
        }
        catch (error) {
            console.error('Error in makeGeminiRequest:', error);
            throw error;
        }
    }
    async chat(messages, options = {}) {
        return await this.makeGeminiRequest(messages, options);
    }
    toJSON() {
        return {
            type: 'VertexProvider',
        };
    }
}
exports.default = VertexProvider;
//# sourceMappingURL=VertexProvider.js.map