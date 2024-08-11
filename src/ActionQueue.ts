class Action {
    name: string;
    schema: string;
    type: string;
    data: any;
    constructor(name: string, schema: string, type: string, data: any) {
        this.name = name;
        this.schema = schema;
        this.type = type;
        this.data = data;
    }
    execute(params: any, state: any, context: any) {
        throw new Error("Not implemented");
    }
}

export class ActionQueue {
    private queue: any = [];

    addAction(action: Action): void {
        this.queue.push(action);
    }

    addActions(actions: Action[]): void {
        this.queue.push(...actions);
    }

    getNextAction(): Action | undefined {
        return this.queue.shift();
    }

    isEmpty(): boolean {
        return this.queue.length === 0;
    }

    size(): number {
        return this.queue.length;
    }

    clear(): void {
        this.queue = [];
    }

    peek(): Action | undefined {
        return this.queue[0];
    }

    removeAction(actionId: string): boolean {
        const initialLength = this.queue.length;
        this.queue = this.queue.filter((action: any) => action.id !== actionId);
        return this.queue.length < initialLength;
    }

    getActions(): Action[] {
        return [...this.queue];
    }

    updateAction(actionId: string, updatedAction: Partial<Action>): boolean {
        const actionIndex = this.queue.findIndex((action: any) => action.id === actionId);
        if (actionIndex !== -1) {
            this.queue[actionIndex] = { ...this.queue[actionIndex], ...updatedAction };
            return true;
        }
        return false;
    }

    // Optional: Add priority queue functionality
    addPriorityAction(action: Action, priority: number): void {
        const priorityAction = { ...action, priority };
        const insertIndex = this.queue.findIndex((a: any) => (a as any).priority > priority);
        if (insertIndex === -1) {
            this.queue.push(priorityAction);
        } else {
            this.queue.splice(insertIndex, 0, priorityAction);
        }
    }

    // Optional: Add batch processing
    processBatch(batchSize: number, processor: (action: Action) => Promise<void>): Promise<void> {
        const batch = this.queue.splice(0, batchSize);
        return Promise.all(batch.map(processor)).then(() => {});
    }
}