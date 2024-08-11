import { Logger, StateManager } from "@nomyx/multi-context-objects";
import EventEmitter from "events";
import PromptManager from "./managers/PromptManager";
import ToolManager from "./managers/ToolManager";
import {ActionQueue} from "./ActionQueue";

interface ExecutionResult {
    success: boolean;
    result?: string;
    error?: string;
    actions?: any[];
    state?: any;
    tasks?: Task[];
    executionTime?: string;
    consoleOutput: string;
}

interface ExecutionContext {
    id: string;
    startTime: number;
    depth: number;
    options: any;
}

interface Task {
    tool: string;
    params: any;
}

class Action {
    name: any;
    type: any;
    schema: any;
    data: any;
    constructor(name: any, schema: any, type: any, data: any) {
        this.name = name;
        this.schema = schema;
        this.type = type;
        this.data = data;
    }
    execute(params: any, state: any, context: any) {
        throw new Error("Not implemented");
    }
}


class MaxDepthError extends Error {
    constructor(message: string) {
        super(message);
    }
}

class ExecutionError extends Error {
    constructor(message: string, public readonly details: any) {
        super(message);
    }
}

class TimeoutError extends Error {
    constructor(message: string) {
        super(message);
    }
}


export class AIExecutionPipeline extends EventEmitter {
    private logger: Logger;

    constructor(
        private promptManager: PromptManager,
        private toolManager: ToolManager,
        private stateManager: StateManager,
        private actionQueue: ActionQueue
    ) {
        super();
        this.logger = Logger.getInstance();
    }

    async execute(prompt: string, params: any = {}, options: any = {}): Promise<ExecutionResult> {
        const context = this.createExecutionContext(options);
        this.logger.info('Starting execution', { prompt, params, executionId: context.id });
        this.emit('executionStart', { prompt, params, executionId: context.id });

        try {
            const result = await this.executeWithTimeout(async () => {
                const promptResult = await this.executePrompt(prompt, params, context);
                await this.processExecutionResult(promptResult, context);
                return promptResult;
            }, context.options.timeout);

            this.logger.info('Execution completed', { executionId: context.id });
            this.emit('executionComplete', { executionId: context.id, result });

            return result;
        } catch (error) {
            this.logger.error('Execution failed', { error, executionId: context.id });
            this.emit('executionError', { error, executionId: context.id });
            throw new ExecutionError('Execution failed', {
                id: context.id,
                startTime: context.startTime,
                depth: context.depth,
                options: context.options,
                cause: error as Error,
                context: {
                    prompt,
                    params
                }
            });
        }
    }

    private async executeWithTimeout<T>(fn: () => Promise<T>, timeout: number): Promise<T> {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new TimeoutError(`Execution timed out after ${timeout}ms`));
            }, timeout);

            fn().then(
                result => {
                    clearTimeout(timer);
                    resolve(result);
                },
                error => {
                    clearTimeout(timer);
                    reject(error);
                }
            );
        });
    }

    private async executePrompt(prompt: string, params: any, context: ExecutionContext): Promise<ExecutionResult> {
        this.logger.debug('Executing prompt', { prompt, executionId: context.id });
        const result = await this.promptManager.executePrompt(prompt, params, context);
        this.logger.debug('Prompt executed', { executionId: context.id, resultSummary: this.summarizeResult(result) });
        return result;
    }

    private async processExecutionResult(result: ExecutionResult, context: ExecutionContext): Promise<void> {
        await this.updateState(result.state, context);
        await this.executeTasks(result.tasks || [], context);
        await this.executeActions(context);
    }

    private async updateState(newState: any, context: ExecutionContext): Promise<void> {
        this.logger.debug('Updating state', { newState, executionId: context.id });
        await this.stateManager.updateState(newState);
        this.emit('stateUpdated', { newState, executionId: context.id });
    }

    private async executeTasks(tasks: Task[], context: ExecutionContext): Promise<void> {
        for (const task of tasks) {
            if (context.depth >= context.options.maxDepth) {
                throw new MaxDepthError(`Maximum execution depth of ${context.options.maxDepth} reached`);
            }

            this.logger.debug('Executing task', { task, executionId: context.id });

            try {
                const taskResult = await this.toolManager.executeTool(task.tool, task.params);
                await this.updateState({ [task.tool]: taskResult }, context);
                
                if (taskResult.actions) {
                    this.actionQueue.addActions(taskResult.actions);
                }
                
                this.emit('taskExecuted', { task, result: taskResult, executionId: context.id });
            } catch (error) {
                this.logger.error('Task execution failed', { task, error, executionId: context.id });
                this.emit('taskError', { task, error, executionId: context.id });
                if (context.options.failFast) {
                    throw error;
                }
            }

            context.depth++;
        }
    }

    private async executeActions(context: ExecutionContext): Promise<void> {
        while (!this.actionQueue.isEmpty()) {
            const action = this.actionQueue.getNextAction();
            if(!action) {
                break;
            }
            this.logger.debug('Executing action', { action, executionId: context.id });

            try {
                const actionResult = await this.executeAction(action, context);
                await this.updateState({ [action.type]: actionResult }, context);

                if (actionResult.tasks) {
                    await this.executeTasks(actionResult.tasks, context);
                }
                if (actionResult.actions) {
                    this.actionQueue.addActions(actionResult.actions);
                }

                this.emit('actionExecuted', { action, result: actionResult, executionId: context.id });
            } catch (error) {
                this.logger.error('Action execution failed', { action, error, executionId: context.id });
                this.emit('actionError', { action, error, executionId: context.id });
                if (context.options.failFast) {
                    throw error;
                }
            }
        }
    }

    private async executeAction(action: Action, context: ExecutionContext): Promise<any> {
        return this.toolManager.executeTool(action.type, action.data);
    }

    private createExecutionContext(options: any): ExecutionContext {
        return {
            id: this.generateExecutionId(),
            startTime: Date.now(),
            depth: 0,
            options: {
                failFast: options.failFast || false,
                maxDepth: options.maxDepth || 10,
                timeout: options.timeout || 30000,
                ...options
            }
        };
    }

    private generateExecutionId(): string {
        return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private summarizeResult(result: ExecutionResult): object {
        return {
            stateKeys: Object.keys(result.state || {}),
            taskCount: result.tasks?.length || 0,
            actionCount: result.actions?.length || 0,
        };
    }
}