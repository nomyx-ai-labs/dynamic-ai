"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiModelSwitch = void 0;
const AIProviderManager_1 = __importDefault(require("src/managers/AIProviderManager"));
function aiModelSwitch(modelSelector) {
    return function (target, propertyKey, descriptor) {
        const originalMethod = descriptor.value;
        descriptor.value = async function (...args) {
            const selectedModel = modelSelector(args[0]);
            const aiProvider = AIProviderManager_1.default.newInstance(this.configuration, this.promptManager, this.toolManager, this.stateManager, this.actionQueue).getProvider(selectedModel);
            return originalMethod.apply({ aiProvider }, args);
        };
        return descriptor;
    };
}
exports.aiModelSwitch = aiModelSwitch;
//# sourceMappingURL=DecoratorFactory.js.map