"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIExecutionPipeline = void 0;
const multi_context_objects_1 = require("@nomyx/multi-context-objects");
const events_1 = __importDefault(require("events"));
class Action {
    constructor(name, schema, type, data) {
        this.name = name;
        this.schema = schema;
        this.type = type;
        this.data = data;
    }
    execute(params, state, context) {
        throw new Error("Not implemented");
    }
}
class MaxDepthError extends Error {
    constructor(message) {
        super(message);
    }
}
class ExecutionError extends Error {
    constructor(message, details) {
        super(message);
        this.details = details;
    }
}
class TimeoutError extends Error {
    constructor(message) {
        super(message);
    }
}
class AIExecutionPipeline extends events_1.default {
    constructor(promptManager, toolManager, stateManager, actionQueue) {
        super();
        this.promptManager = promptManager;
        this.toolManager = toolManager;
        this.stateManager = stateManager;
        this.actionQueue = actionQueue;
        this.logger = multi_context_objects_1.Logger.getInstance();
    }
    async execute(prompt, params = {}, options = {}) {
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
        }
        catch (error) {
            this.logger.error('Execution failed', { error, executionId: context.id });
            this.emit('executionError', { error, executionId: context.id });
            throw new ExecutionError('Execution failed', {
                id: context.id,
                startTime: context.startTime,
                depth: context.depth,
                options: context.options,
                cause: error,
                context: {
                    prompt,
                    params
                }
            });
        }
    }
    async executeWithTimeout(fn, timeout) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new TimeoutError(`Execution timed out after ${timeout}ms`));
            }, timeout);
            fn().then(result => {
                clearTimeout(timer);
                resolve(result);
            }, error => {
                clearTimeout(timer);
                reject(error);
            });
        });
    }
    async executePrompt(prompt, params, context) {
        this.logger.debug('Executing prompt', { prompt, executionId: context.id });
        const result = await this.promptManager.executePrompt(prompt, params, context);
        this.logger.debug('Prompt executed', { executionId: context.id, resultSummary: this.summarizeResult(result) });
        return result;
    }
    async processExecutionResult(result, context) {
        await this.updateState(result.state, context);
        await this.executeTasks(result.tasks || [], context);
        await this.executeActions(context);
    }
    async updateState(newState, context) {
        this.logger.debug('Updating state', { newState, executionId: context.id });
        await this.stateManager.updateState(newState);
        this.emit('stateUpdated', { newState, executionId: context.id });
    }
    async executeTasks(tasks, context) {
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
            }
            catch (error) {
                this.logger.error('Task execution failed', { task, error, executionId: context.id });
                this.emit('taskError', { task, error, executionId: context.id });
                if (context.options.failFast) {
                    throw error;
                }
            }
            context.depth++;
        }
    }
    async executeActions(context) {
        while (!this.actionQueue.isEmpty()) {
            const action = this.actionQueue.getNextAction();
            if (!action) {
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
            }
            catch (error) {
                this.logger.error('Action execution failed', { action, error, executionId: context.id });
                this.emit('actionError', { action, error, executionId: context.id });
                if (context.options.failFast) {
                    throw error;
                }
            }
        }
    }
    async executeAction(action, context) {
        return this.toolManager.executeTool(action.type, action.data);
    }
    createExecutionContext(options) {
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
    generateExecutionId() {
        return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    summarizeResult(result) {
        var _a, _b;
        return {
            stateKeys: Object.keys(result.state || {}),
            taskCount: ((_a = result.tasks) === null || _a === void 0 ? void 0 : _a.length) || 0,
            actionCount: ((_b = result.actions) === null || _b === void 0 ? void 0 : _b.length) || 0,
        };
    }
}
exports.AIExecutionPipeline = AIExecutionPipeline;
//# sourceMappingURL=AIExecutionPipeline.js.map