# FX Flow & Serialization Complete Guide

## Overview

The FX Flow and Serialization plugins provide a powerful, synchronous-first approach to building complex workflows and state management without async/await patterns in the main thread.

### Key Features

- **No async/await in main thread** - Uses FX_SUSPEND pattern for async operations
- **Flow execution** - Create and execute complex workflow graphs
- **State serialization** - Save and restore complete flow state
- **Cross-realm execution** - Run flow nodes on client, server, or both
- **Error handling** - Built-in retry, circuit breaker patterns
- **Event system** - Rich event hooks for monitoring and debugging

## Table of Contents

1. [Installation & Setup](#installation--setup)
2. [FX Flow Plugin](#fx-flow-plugin)
3. [FX Serialize Plugin](#fx-serialize-plugin)
4. [Integration Guide](#integration-guide)
5. [Advanced Patterns](#advanced-patterns)
6. [API Reference](#api-reference)
7. [Testing](#testing)
8. [Troubleshooting](#troubleshooting)

## Installation & Setup

### Basic Setup

```typescript
import FXCore from './fx.v4';
import createFlowPlugin from './plugins/fx-flow';
import createSerializePlugin from './plugins/fx-serialize';

// Initialize FX Core
const fx = new FXCore();

// Add plugins
const flowPlugin = createFlowPlugin(fx, {
    order: 'bfs',           // Breadth-first execution
    budgets: {
        maxSteps: 1000,     // Max steps per pump
        maxMillis: 5000     // Max time per pump
    },
    logSize: 128           // Ring buffer size for logs
});

const serializePlugin = createSerializePlugin(fx, {
    includePrivateProps: false,
    preserveClassInstances: true,
    maxDepth: 50
});

// Register plugins globally
(globalThis as any).__fxPlugins = {
    flow: flowPlugin,
    serialize: serializePlugin
};
```

## FX Flow Plugin

### Creating a Flow

```typescript
// Create a new flow
const flow = flowPlugin.flow('flows.myWorkflow');

// Define nodes
flow.node('start', {
    runsOn: 'client',  // Where to execute: 'client' | 'server' | 'both'
    effect: (ctx) => {
        console.log('Starting with:', ctx.in);
        ctx.set('Started');           // Set node value
        ctx.next('process', ctx.in);  // Queue next node
    }
});

flow.node('process', {
    runsOn: 'server',  // Execute on server
    effect: (ctx) => {
        const result = processData(ctx.in);
        ctx.set(result);
        ctx.next('complete', result);
    },
    retry: {           // Retry configuration
        maxAttempts: 3,
        backoffMs: 1000,
        multiplier: 2
    }
});

// Connect nodes (optional, can use ctx.next() instead)
flow.connect('start', 'process');
flow.connect('process', 'complete');

// Start execution
flow.start('start', { data: 'initial payload' });

// Run synchronously (processes queue)
flow.runSync(100);  // Max 100 steps
```

### Branching and Conditionals

```typescript
// If/else branching
flow.node('decide', {
    runsOn: 'client',
    branch: {
        when: (ctx) => ctx.in.value > 100,
        then: 'highValue',
        else: 'lowValue'
    },
    effect: (ctx) => {
        ctx.log('Decision point reached');
        ctx.set({ decided: true });
    }
});

// Switch statement branching
flow.node('router', {
    runsOn: 'client',
    branch: {
        switch: (ctx) => ctx.in.type,
        cases: {
            'typeA': 'handlerA',
            'typeB': 'handlerB',
            'typeC': 'handlerC'
        },
        default: 'defaultHandler'
    }
});
```

### Guards and Validation

```typescript
flow.node('protected', {
    runsOn: 'client',
    guard: (ctx) => {
        // Return false to skip execution
        return ctx.in.authorized === true;
    },
    effect: (ctx) => {
        // Only runs if guard passes
        ctx.set('Protected operation complete');
    }
});
```

### Error Handling

```typescript
flow.node('risky', {
    runsOn: 'server',
    effect: (ctx) => {
        if (Math.random() > 0.5) {
            throw new Error('Random failure');
        }
        ctx.set('Success');
    },
    retry: {
        maxAttempts: 3,
        backoffMs: 1000,
        multiplier: 2,
        jitter: true,
        useSafePlugin: true  // Use fx-safe if available
    }
});

// Listen for errors
flow.on('node:error:risky', (event) => {
    console.error('Node failed:', event.error);
});
```

### Cross-Realm Execution

```typescript
flow.node('hybrid', {
    runsOn: 'both',  // Run on both client and server
    parallelBoth: 'serverFirst',  // or 'clientFirst' or 'parallel'
    effect: (ctx) => {
        // ctx.runOn tells you where this is executing
        if (ctx.runOn === 'server') {
            // Server-specific logic
            ctx.set({ fromServer: true });
        } else {
            // Client-specific logic
            ctx.set({ fromClient: true });
        }
    }
});
```

### Using FX_SUSPEND for Async Operations

```typescript
flow.node('asyncOp', {
    runsOn: 'client',
    effect: (ctx) => {
        // For async operations in main thread
        if (typeof window !== 'undefined') {
            const promise = fetch('/api/data')
                .then(res => res.json())
                .then(data => {
                    ctx.set(data);
                    ctx.next('processData', data);
                });

            // Throw FX_SUSPEND to handle async without blocking
            throw new (globalThis as any).FXSuspend(promise);
        }

        // Fallback for non-browser environments
        ctx.set({ mock: 'data' });
        ctx.next('processData', { mock: 'data' });
    }
});
```

## FX Serialize Plugin

### Basic Serialization

```typescript
// Serialize entire flow
const flowState = serializePlugin.wrap(flowNode);

// Serialize with options
const compressed = serializePlugin.wrap(flowNode, {
    includePrivateProps: true,
    compressOutput: true,
    maxDepth: 100
});

// Restore from serialized state
const restoredNode = serializePlugin.expand(flowState);
```

### Class Instance Serialization

```typescript
// Register classes for serialization
class CustomProcessor {
    constructor(public config: any) {}
    process(data: any) { return data; }
}

serializePlugin.registerClass(CustomProcessor, 'CustomProcessor');

// Custom serializers for complex types
serializePlugin.registerSerializer(
    'CustomProcessor',
    (instance: CustomProcessor) => ({
        config: instance.config
    }),
    (data: any) => new CustomProcessor(data.config)
);
```

### Partial Serialization

```typescript
// Serialize only specific paths
const partial = serializePlugin.wrapPartial([
    'flows.workflow1.nodes.process',
    'flows.workflow1.runtime.shared'
]);

// Compare two states
const stateA = serializePlugin.wrap(nodeA);
const stateB = serializePlugin.wrap(nodeB);
const differences = serializePlugin.compare(stateA, stateB);

differences.forEach(diff => {
    console.log(`${diff.path}: ${diff.a} -> ${diff.b}`);
});
```

## Integration Guide

### Flow with Serialization

```typescript
// Create flow with save/restore capability
const flow = flowPlugin.flow('flows.persistentWorkflow');

// ... define nodes ...

// Save flow state
const savedState = flow.serialize();
localStorage.setItem('workflow_state', JSON.stringify(savedState));

// Later: restore flow state
const restoredState = JSON.parse(localStorage.getItem('workflow_state'));
const newFlow = flowPlugin.flow('flows.persistentWorkflow');
newFlow.deserialize(restoredState);

// Continue execution
newFlow.runSync();
```

### Nested Flows

```typescript
flow.node('parent', {
    runsOn: 'client',
    effect: (ctx) => {
        // Spawn a child flow
        ctx.spawnFlow('childFlow', (child) => {
            child.node('childStart', {
                runsOn: 'client',
                effect: (childCtx) => {
                    childCtx.set('Child processed');
                }
            });
        }, {
            atNode: 'childStart',
            payload: { fromParent: true }
        });

        // Or plan without starting
        ctx.planFlow('plannedFlow', (planned) => {
            // Define flow structure
        });
    }
});
```

### Shared Context

```typescript
flow.node('writer', {
    runsOn: 'client',
    effect: (ctx) => {
        // Write to shared context
        ctx.shared.globalData = 'Available to all nodes';
        ctx.shared.timestamp = Date.now();
    }
});

flow.node('reader', {
    runsOn: 'client',
    effect: (ctx) => {
        // Read from shared context
        console.log('Shared data:', ctx.shared.globalData);
    }
});
```

## Advanced Patterns

### 1. Saga Pattern

```typescript
const saga = flowPlugin.flow('flows.saga');

saga.node('transaction', {
    runsOn: 'server',
    effect: (ctx) => {
        try {
            // Perform transaction
            const result = performTransaction(ctx.in);
            ctx.set(result);
            ctx.next('commit', result);
        } catch (error) {
            // Trigger compensation
            ctx.next('rollback', { error, original: ctx.in });
        }
    }
});

saga.node('rollback', {
    runsOn: 'server',
    effect: (ctx) => {
        // Compensating transaction
        undoTransaction(ctx.in.original);
        ctx.set({ rolledBack: true });
    }
});
```

### 2. Circuit Breaker

```typescript
const circuitBreaker = flowPlugin.flow('flows.circuitBreaker');

circuitBreaker.node('breaker', {
    runsOn: 'client',
    effect: (ctx) => {
        const failures = ctx.shared.failures || 0;

        if (failures > 3) {
            // Circuit open
            ctx.warn('Circuit open, skipping operation');
            ctx.next('fallback', ctx.in);
            return;
        }

        try {
            const result = riskyOperation(ctx.in);
            ctx.shared.failures = 0;  // Reset on success
            ctx.next('success', result);
        } catch (error) {
            ctx.shared.failures = failures + 1;
            ctx.next('fallback', ctx.in);
        }
    }
});
```

### 3. Event Sourcing

```typescript
const eventSourced = flowPlugin.flow('flows.eventSourced');

eventSourced.node('applyEvent', {
    runsOn: 'client',
    effect: (ctx) => {
        const event = ctx.in;

        // Store event
        if (!ctx.shared.events) ctx.shared.events = [];
        ctx.shared.events.push({
            ...event,
            timestamp: Date.now()
        });

        // Apply event to state
        const newState = applyEventToState(ctx.shared.state, event);
        ctx.shared.state = newState;

        // Serialize for persistence
        const snapshot = serializePlugin.wrap(ctx.shared);
        saveSnapshot(snapshot);

        ctx.set(newState);
    }
});
```

## API Reference

### Flow Plugin API

#### `flowPlugin.flow(path?: string): FlowAPI`
Creates a new flow at the specified path.

#### FlowAPI Methods

- `node(name: string, def: NodeDef): FlowAPI` - Define a flow node
- `connect(from: string, ...to: string[]): FlowAPI` - Connect nodes
- `start(firstNode: string, payload: any): FlowAPI` - Start flow execution
- `set(name: string, value: any): FlowAPI` - Set node value directly
- `on(event: OnEvent, callback: Function): Function` - Subscribe to events
- `off(event: OnEvent, callback: Function): void` - Unsubscribe from events
- `serialize(): any` - Serialize flow state
- `deserialize(state: any): FlowAPI` - Restore flow state
- `runSync(maxSteps?: number): FlowAPI` - Execute flow synchronously

#### Node Context (ctx)

- `in: any` - Input payload
- `set(value: any): void` - Set node value
- `next(nodeName: string, payload?: any): void` - Queue next node
- `spawnFlow(name: string, builder: Function, autoStart?: object): void` - Create child flow
- `planFlow(name: string, builder: Function): void` - Plan flow without starting
- `log(...args: any[]): void` - Log to node logs
- `warn(...args: any[]): void` - Log warning
- `error(...args: any[]): void` - Log error
- `meta: object` - Node metadata
- `$db: any` - Database access (if available)
- `traceId: string` - Unique trace ID
- `shared: object` - Shared context
- `abortSignal: AbortSignal | null` - Abort signal
- `runOn: 'client' | 'server'` - Current execution realm

### Serialize Plugin API

#### `serializePlugin.wrap(node: FXNode, options?: SerializationOptions): SerializedState`
Serialize an FX node and its children.

#### `serializePlugin.expand(state: SerializedState, target?: FXNode): FXNode`
Restore serialized state to an FX node.

#### `serializePlugin.registerClass(constructor: Function, name?: string): SerializePlugin`
Register a class for serialization.

#### `serializePlugin.registerSerializer(type: string, serializer: Function, deserializer: Function): SerializePlugin`
Register custom serializer/deserializer for a type.

#### `serializePlugin.wrapPartial(paths: string[], options?: SerializationOptions): SerializedState`
Serialize only specific paths.

#### `serializePlugin.compare(stateA: SerializedState, stateB: SerializedState): Difference[]`
Compare two serialized states.

#### `serializePlugin.compress(state: SerializedState): SerializedState`
Compress serialized state.

## Testing

### Running Tests

```typescript
import tests from './tests/fx-flow-serialize.test';

// Run all tests
const results = tests.runAllTests();

// Run specific test
tests.tests.testSimpleFlowCreation();
tests.tests.testSerializeFlowState();
```

### Test Coverage

The test suite covers:

- Simple flow creation (A → B → C)
- Branching flows (if/else, switch)
- Looping flows
- Flow execution
- Simple object serialization
- Nested object serialization
- Flow state serialization and restoration
- Error handling
- FX_SUSPEND pattern
- Cross-node communication
- Nested flow execution
- Complex flows with all features

## Troubleshooting

### Common Issues

#### 1. FX_SUSPEND not working

**Problem**: Async operations blocking main thread

**Solution**: Ensure FXSuspend is available globally:
```typescript
if (!(globalThis as any).FXSuspend) {
    (globalThis as any).FXSuspend = class FXSuspend extends Error {
        constructor(public promise: Promise<any>) {
            super('FX_SUSPEND');
        }
    };
}
```

#### 2. Serialization missing data

**Problem**: Some data not included in serialized state

**Solution**: Check serialization options:
```typescript
const state = serializePlugin.wrap(node, {
    includePrivateProps: true,  // Include _prefixed properties
    includeFunctions: false,     // Functions can't be serialized
    maxDepth: 100               // Increase if deeply nested
});
```

#### 3. Flow not executing

**Problem**: Nodes defined but not running

**Solution**: Ensure you call `runSync()` after `start()`:
```typescript
flow.start('firstNode', payload);
flow.runSync(100);  // Process up to 100 steps
```

#### 4. Cross-realm execution failing

**Problem**: Server execution not working from client

**Solution**: Check SABBridge initialization and fallback to HTTP:
```typescript
// The plugin automatically falls back to HTTP if SAB not available
// Ensure your server endpoint is configured at /fx/flow/execute
```

#### 5. Circular references in serialization

**Problem**: Serialization fails with circular reference

**Solution**: The serializer handles circular references automatically:
```typescript
// Circular references are marked with __fx_circular_reference
// The expand() method resolves these references
```

### Debug Mode

Enable detailed logging:

```typescript
// In your node effects
flow.node('debug', {
    runsOn: 'client',
    effect: (ctx) => {
        ctx.log('Input:', ctx.in);
        ctx.log('Shared:', ctx.shared);
        ctx.log('Trace ID:', ctx.traceId);

        // Check node logs
        const logs = fx.val(fx.resolvePath('flows.myflow.nodes.debug.logs.ring'));
        console.log('Node logs:', logs);
    }
});

// Listen to all events
flow.on('flow:start', (e) => console.log('Flow started:', e));
flow.on('flow:idle', (e) => console.log('Flow idle:', e));
flow.on('flow:error', (e) => console.error('Flow error:', e));
```

### Performance Tips

1. **Use appropriate execution order**:
   - BFS (breadth-first): Better for parallel operations
   - DFS (depth-first): Better for sequential pipelines

2. **Set reasonable budgets**:
   ```typescript
   const flow = flowPlugin.flow('flows.optimized', {
       budgets: {
           maxSteps: 1000,    // Prevent infinite loops
           maxMillis: 5000,   // Prevent long-running flows
           maxDepth: 50       // Prevent deep recursion
       }
   });
   ```

3. **Minimize shared context**:
   - Only store essential data in `ctx.shared`
   - Clear unused data when no longer needed

4. **Use guards to skip unnecessary nodes**:
   ```typescript
   guard: (ctx) => ctx.in.needsProcessing === true
   ```

5. **Batch operations when possible**:
   - Process multiple items in a single node
   - Use array payloads for batch processing

## Conclusion

The FX Flow and Serialization plugins provide a powerful, synchronous-first approach to building complex workflows without async/await in the main thread. By leveraging the FX_SUSPEND pattern and comprehensive state serialization, you can build resilient, pauseable, and resumable workflows that work seamlessly across client and server environments.

For more examples, see the `examples/flow-examples.ts` file which includes complete implementations of:
- E-commerce order processing
- ETL data pipelines
- Document approval workflows

Happy flowing!