import { ContextType, Configuration } from "@nomyx/multi-context-objects";
import AIProviderManager from "src/managers/AIProviderManager";
import { AIProviderType } from "src/types";

export function aiModelSwitch(modelSelector: (input: any) => AIProviderType) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
      const originalMethod = descriptor.value;
      descriptor.value = async function (this: { 
        executeInContext: (context: ContextType, methodName: string, ...args: any[]) => Promise<any>,
        getCurrentContext: () => ContextType,
        configuration: Configuration,
        promptManager: any,
        toolManager: any,
        stateManager: any,
        actionQueue: any
      },
      ...args: any[]) {
        const selectedModel = modelSelector(args[0]);
        const aiProvider = AIProviderManager.newInstance(
          this.configuration,
          this.promptManager,
          this.toolManager,
          this.stateManager,
          this.actionQueue
        ).getProvider(selectedModel);
        return originalMethod.apply({ aiProvider }, args);
      };
      return descriptor;
    };
  }
  