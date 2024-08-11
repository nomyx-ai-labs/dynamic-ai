"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActionQueue = void 0;
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
class ActionQueue {
    constructor() {
        this.queue = [];
    }
    addAction(action) {
        this.queue.push(action);
    }
    addActions(actions) {
        this.queue.push(...actions);
    }
    getNextAction() {
        return this.queue.shift();
    }
    isEmpty() {
        return this.queue.length === 0;
    }
    size() {
        return this.queue.length;
    }
    clear() {
        this.queue = [];
    }
    peek() {
        return this.queue[0];
    }
    removeAction(actionId) {
        const initialLength = this.queue.length;
        this.queue = this.queue.filter((action) => action.id !== actionId);
        return this.queue.length < initialLength;
    }
    getActions() {
        return [...this.queue];
    }
    updateAction(actionId, updatedAction) {
        const actionIndex = this.queue.findIndex((action) => action.id === actionId);
        if (actionIndex !== -1) {
            this.queue[actionIndex] = { ...this.queue[actionIndex], ...updatedAction };
            return true;
        }
        return false;
    }
    // Optional: Add priority queue functionality
    addPriorityAction(action, priority) {
        const priorityAction = { ...action, priority };
        const insertIndex = this.queue.findIndex((a) => a.priority > priority);
        if (insertIndex === -1) {
            this.queue.push(priorityAction);
        }
        else {
            this.queue.splice(insertIndex, 0, priorityAction);
        }
    }
    // Optional: Add batch processing
    processBatch(batchSize, processor) {
        const batch = this.queue.splice(0, batchSize);
        return Promise.all(batch.map(processor)).then(() => { });
    }
}
exports.ActionQueue = ActionQueue;
//# sourceMappingURL=ActionQueue.js.map