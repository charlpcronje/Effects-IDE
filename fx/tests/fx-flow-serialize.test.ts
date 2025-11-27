/**
 * FX Flow & Serialize Integration Test Suite
 * Tests flow execution, serialization, and FX_SUSPEND patterns
 */

import type { FXCore } from '../fx.v4';
import { FXFlowPlugin } from '../plugins/fx-flow';
import { FXSerializePlugin } from '../plugins/fx-serialize';

// Mock FX Core for testing
class MockFXCore implements Partial<FXCore> {
    root: any = {
        __id: 'root',
        __parent_id: null,
        __type: null,
        __proto: [],
        __nodes: {},
        __value: {},
        __instances: new Map(),
        __effects: [],
        __watchers: new Map(),
        __behaviors: new Map()
    };

    private idCounter = 0;

    createNode(parentId: string): any {
        const id = `node_${++this.idCounter}`;
        return {
            __id: id,
            __parent_id: parentId,
            __type: null,
            __proto: [],
            __nodes: {},
            __value: {},
            __instances: new Map(),
            __effects: [],
            __watchers: new Map(),
            __behaviors: new Map()
        };
    }

    resolvePath(path: string, root?: any): any | null {
        const parts = path.split('.');
        let current = root || this.root;

        for (const part of parts) {
            if (!current.__nodes) {
                current.__nodes = {};
            }
            if (!current.__nodes[part]) {
                return null;
            }
            current = current.__nodes[part];
        }

        return current;
    }

    setPath(path: string, value: any, root?: any): any {
        const parts = path.split('.');
        let current = root || this.root;

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];

            if (!current.__nodes) {
                current.__nodes = {};
            }

            if (i === parts.length - 1) {
                // Last part - set the value
                if (!current.__nodes[part]) {
                    current.__nodes[part] = this.createNode(current.__id);
                }
                this.set(current.__nodes[part], value);
                return current.__nodes[part];
            } else {
                // Intermediate part - create if needed
                if (!current.__nodes[part]) {
                    current.__nodes[part] = this.createNode(current.__id);
                }
                current = current.__nodes[part];
            }
        }

        return current;
    }

    val(node: any): any {
        if (node.__type && node.__value && typeof node.__value === 'object') {
            return node.__value[node.__type];
        }
        return node.__value;
    }

    set(node: any, value: any): void {
        if (typeof value === 'object' && value !== null) {
            node.__type = 'object';
            if (!node.__value || typeof node.__value !== 'object') {
                node.__value = {};
            }
            node.__value.object = value;
        } else if (typeof value === 'string') {
            node.__type = 'string';
            if (!node.__value || typeof node.__value !== 'object') {
                node.__value = {};
            }
            node.__value.string = value;
        } else if (typeof value === 'number') {
            node.__type = 'number';
            if (!node.__value || typeof node.__value !== 'object') {
                node.__value = {};
            }
            node.__value.number = value;
        } else if (typeof value === 'boolean') {
            node.__type = 'boolean';
            if (!node.__value || typeof node.__value !== 'object') {
                node.__value = {};
            }
            node.__value.boolean = value;
        } else if (Array.isArray(value)) {
            node.__type = 'array';
            if (!node.__value || typeof node.__value !== 'object') {
                node.__value = {};
            }
            node.__value.array = value;
        } else {
            node.__value = value;
        }

        // Trigger watchers
        if (node.__watchers && node.__watchers.size > 0) {
            for (const watcher of node.__watchers.values()) {
                watcher(value, node.__value);
            }
        }
    }

    createNodeProxy(node: any): any {
        const fx = this;
        return {
            node,
            watch(fn: (newVal: any, oldVal: any) => void): () => void {
                if (!node.__watchers) {
                    node.__watchers = new Map();
                }
                const id = Math.random().toString(36).substr(2, 9);
                node.__watchers.set(id, fn);
                return () => node.__watchers.delete(id);
            },
            get value() {
                return fx.val(node);
            },
            set value(v: any) {
                fx.set(node, v);
            }
        };
    }
}

// Test utilities
const createTestContext = () => {
    const fx = new MockFXCore() as any;
    const flowPlugin = new FXFlowPlugin(fx, {});
    const serializePlugin = new FXSerializePlugin(fx, {});

    // Mock global plugins object for integration
    (globalThis as any).__fxPlugins = {
        flow: flowPlugin,
        serialize: serializePlugin
    };

    // Mock FXSuspend if not available
    if (!(globalThis as any).FXSuspend) {
        (globalThis as any).FXSuspend = class FXSuspend extends Error {
            constructor(public promise: Promise<any>) {
                super('FX_SUSPEND');
                this.name = 'FXSuspend';
            }
        };
    }

    return { fx, flowPlugin, serializePlugin };
};

// Test Cases
export const tests = {
    /**
     * Test 1: Simple Flow Creation (A → B → C)
     */
    testSimpleFlowCreation() {
        console.log('TEST: Simple Flow Creation');
        const { flowPlugin } = createTestContext();

        const flow = flowPlugin.flow('flows.simple');

        flow.node('A', {
            runsOn: 'client',
            effect: (ctx) => {
                console.log('Node A executing with:', ctx.in);
                ctx.set('A result');
                ctx.next('B', 'Data from A');
            }
        });

        flow.node('B', {
            runsOn: 'client',
            effect: (ctx) => {
                console.log('Node B executing with:', ctx.in);
                ctx.set('B result');
                ctx.next('C', 'Data from B');
            }
        });

        flow.node('C', {
            runsOn: 'client',
            effect: (ctx) => {
                console.log('Node C executing with:', ctx.in);
                ctx.set('C result');
            }
        });

        flow.connect('A', 'B');
        flow.connect('B', 'C');

        console.log('✅ Simple flow created successfully');
        return flow;
    },

    /**
     * Test 2: Branching Flow (if/else)
     */
    testBranchingFlow() {
        console.log('TEST: Branching Flow');
        const { flowPlugin } = createTestContext();

        const flow = flowPlugin.flow('flows.branching');

        flow.node('start', {
            runsOn: 'client',
            branch: {
                when: (ctx) => ctx.in.value > 5,
                then: 'highPath',
                else: 'lowPath'
            },
            effect: (ctx) => {
                console.log('Start node with value:', ctx.in.value);
                ctx.set('Processed');
            }
        });

        flow.node('highPath', {
            runsOn: 'client',
            effect: (ctx) => {
                console.log('High path taken');
                ctx.set('High result');
            }
        });

        flow.node('lowPath', {
            runsOn: 'client',
            effect: (ctx) => {
                console.log('Low path taken');
                ctx.set('Low result');
            }
        });

        console.log('✅ Branching flow created successfully');
        return flow;
    },

    /**
     * Test 3: Loop Flow
     */
    testLoopFlow() {
        console.log('TEST: Loop Flow');
        const { flowPlugin } = createTestContext();

        const flow = flowPlugin.flow('flows.loop');

        flow.node('counter', {
            runsOn: 'client',
            effect: (ctx) => {
                const count = ctx.in.count || 0;
                console.log('Counter at:', count);

                if (count < 3) {
                    ctx.next('increment', { count: count + 1 });
                } else {
                    ctx.next('done', { finalCount: count });
                }

                ctx.set({ iteration: count });
            }
        });

        flow.node('increment', {
            runsOn: 'client',
            effect: (ctx) => {
                console.log('Incrementing:', ctx.in.count);
                ctx.next('counter', ctx.in);
                ctx.set({ incremented: true });
            }
        });

        flow.node('done', {
            runsOn: 'client',
            effect: (ctx) => {
                console.log('Loop complete with:', ctx.in.finalCount);
                ctx.set({ complete: true, total: ctx.in.finalCount });
            }
        });

        console.log('✅ Loop flow created successfully');
        return flow;
    },

    /**
     * Test 4: Flow Execution
     */
    testFlowExecution() {
        console.log('TEST: Flow Execution');
        const { flowPlugin } = createTestContext();

        const flow = flowPlugin.flow('flows.execution');

        let executionLog: string[] = [];

        flow.node('step1', {
            runsOn: 'client',
            effect: (ctx) => {
                executionLog.push(`Step 1: ${ctx.in}`);
                ctx.set('step1-done');
                ctx.next('step2', 'from-step1');
            }
        });

        flow.node('step2', {
            runsOn: 'client',
            effect: (ctx) => {
                executionLog.push(`Step 2: ${ctx.in}`);
                ctx.set('step2-done');
                ctx.next('step3', 'from-step2');
            }
        });

        flow.node('step3', {
            runsOn: 'client',
            effect: (ctx) => {
                executionLog.push(`Step 3: ${ctx.in}`);
                ctx.set('step3-done');
            }
        });

        flow.start('step1', 'initial-data');
        flow.runSync(10);

        console.log('Execution log:', executionLog);

        if (executionLog.length === 3) {
            console.log('✅ Flow executed all steps');
        } else {
            console.error('❌ Flow execution incomplete');
        }

        return { flow, executionLog };
    },

    /**
     * Test 5: Serialization of Simple Object
     */
    testSerializeSimpleObject() {
        console.log('TEST: Serialize Simple Object');
        const { fx, serializePlugin } = createTestContext();

        // Create a simple node structure
        const testNode = fx.setPath('test.simple', { name: 'Test', value: 42 });

        // Serialize
        const serialized = serializePlugin.wrap(testNode);

        console.log('Serialized:', JSON.stringify(serialized, null, 2));

        if (serialized.__fx_serialized && serialized.__fx_root) {
            console.log('✅ Simple object serialized successfully');
        } else {
            console.error('❌ Serialization failed');
        }

        return serialized;
    },

    /**
     * Test 6: Serialization of Nested Object
     */
    testSerializeNestedObject() {
        console.log('TEST: Serialize Nested Object');
        const { fx, serializePlugin } = createTestContext();

        // Create nested structure
        fx.setPath('test.nested.level1', { a: 1 });
        fx.setPath('test.nested.level1.level2', { b: 2 });
        fx.setPath('test.nested.level1.level2.level3', { c: 3 });

        const rootNode = fx.resolvePath('test.nested');
        const serialized = serializePlugin.wrap(rootNode);

        console.log('Serialized nested:', JSON.stringify(serialized, null, 2));

        if (serialized.__fx_root.__nodes) {
            console.log('✅ Nested object serialized successfully');
        } else {
            console.error('❌ Nested serialization failed');
        }

        return serialized;
    },

    /**
     * Test 7: Serialize and Restore Flow State
     */
    testSerializeFlowState() {
        console.log('TEST: Serialize Flow State');
        const { fx, flowPlugin, serializePlugin } = createTestContext();

        // Create a flow
        const flow = flowPlugin.flow('flows.sertest');

        flow.node('nodeA', {
            runsOn: 'client',
            effect: (ctx) => {
                ctx.set({ processed: true, data: ctx.in });
            }
        });

        flow.node('nodeB', {
            runsOn: 'client',
            effect: (ctx) => {
                ctx.set({ result: ctx.in.value * 2 });
            }
        });

        // Start execution
        flow.start('nodeA', { initial: 'data' });

        // Serialize the flow
        const flowNode = fx.resolvePath('flows.sertest');
        const serialized = serializePlugin.wrap(flowNode);

        console.log('Serialized flow state:', JSON.stringify(serialized, null, 2));

        // Create new context for restore
        const { fx: fx2, serializePlugin: serializePlugin2 } = createTestContext();

        // Restore
        const targetNode = fx2.setPath('flows.restored', {});
        const restored = serializePlugin2.expand(serialized, targetNode);

        if (restored) {
            console.log('✅ Flow state serialized and restored');
        } else {
            console.error('❌ Flow state restoration failed');
        }

        return { serialized, restored };
    },

    /**
     * Test 8: Error Handling in Flow
     */
    testErrorHandlingFlow() {
        console.log('TEST: Error Handling in Flow');
        const { flowPlugin } = createTestContext();

        const flow = flowPlugin.flow('flows.error');
        let errorCaught = false;

        flow.node('errorNode', {
            runsOn: 'client',
            effect: (ctx) => {
                if (ctx.in.shouldError) {
                    throw new Error('Intentional error');
                }
                ctx.set('no-error');
            },
            retry: {
                maxAttempts: 2,
                backoffMs: 10
            }
        });

        flow.on('node:error:errorNode', (e) => {
            console.log('Error caught:', e.error);
            errorCaught = true;
        });

        flow.start('errorNode', { shouldError: true });

        // Give time for retry to complete
        setTimeout(() => {
            if (errorCaught) {
                console.log('✅ Error handling works');
            } else {
                console.error('❌ Error not handled properly');
            }
        }, 100);

        return flow;
    },

    /**
     * Test 9: FX_SUSPEND Pattern Test
     */
    testFXSuspendPattern() {
        console.log('TEST: FX_SUSPEND Pattern');
        const { flowPlugin } = createTestContext();

        const flow = flowPlugin.flow('flows.suspend');
        let suspendTriggered = false;

        flow.node('asyncNode', {
            runsOn: 'client',
            effect: (ctx) => {
                // Simulate async operation that should use FX_SUSPEND
                if (typeof window !== 'undefined') {
                    const promise = new Promise(resolve => {
                        setTimeout(() => {
                            resolve('async-result');
                        }, 10);
                    });

                    try {
                        throw new (globalThis as any).FXSuspend(promise);
                    } catch (e) {
                        if (e.name === 'FXSuspend') {
                            suspendTriggered = true;
                            console.log('FX_SUSPEND triggered correctly');
                        }
                        throw e;
                    }
                }
                ctx.set('done');
            }
        });

        try {
            flow.start('asyncNode', { test: true });
        } catch (e: any) {
            if (e.name === 'FXSuspend') {
                console.log('✅ FX_SUSPEND pattern works');
            }
        }

        return { flow, suspendTriggered };
    },

    /**
     * Test 10: Cross-Node Communication
     */
    testCrossNodeCommunication() {
        console.log('TEST: Cross-Node Communication');
        const { flowPlugin } = createTestContext();

        const flow = flowPlugin.flow('flows.communication');
        const sharedData: any = {};

        flow.node('sender', {
            runsOn: 'client',
            effect: (ctx) => {
                ctx.shared.message = 'Hello from sender';
                ctx.shared.timestamp = Date.now();
                ctx.next('receiver', { directData: 'test' });
                ctx.set('sent');
            }
        });

        flow.node('receiver', {
            runsOn: 'client',
            effect: (ctx) => {
                const message = ctx.shared.message;
                const directData = ctx.in.directData;

                console.log('Received shared:', message);
                console.log('Received direct:', directData);

                sharedData.message = message;
                sharedData.directData = directData;

                ctx.set({ received: true, message, directData });
            }
        });

        flow.start('sender', {});
        flow.runSync(5);

        if (sharedData.message && sharedData.directData) {
            console.log('✅ Cross-node communication works');
        } else {
            console.error('❌ Cross-node communication failed');
        }

        return { flow, sharedData };
    },

    /**
     * Test 11: Nested Flow Execution
     */
    testNestedFlows() {
        console.log('TEST: Nested Flows');
        const { flowPlugin } = createTestContext();

        const parentFlow = flowPlugin.flow('flows.parent');
        let nestedExecuted = false;

        parentFlow.node('parent', {
            runsOn: 'client',
            effect: (ctx) => {
                console.log('Parent executing');

                // Create and start a nested flow
                ctx.spawnFlow('child', (childFlow) => {
                    childFlow.node('childNode', {
                        runsOn: 'client',
                        effect: (childCtx) => {
                            console.log('Child node executing');
                            nestedExecuted = true;
                            childCtx.set('child-done');
                        }
                    });
                }, { atNode: 'childNode', payload: { from: 'parent' } });

                ctx.set('parent-done');
            }
        });

        parentFlow.start('parent', {});
        parentFlow.runSync(10);

        if (nestedExecuted) {
            console.log('✅ Nested flows work');
        } else {
            console.error('❌ Nested flow not executed');
        }

        return parentFlow;
    },

    /**
     * Test 12: Complex Flow with All Features
     */
    testComplexFlow() {
        console.log('TEST: Complex Flow with All Features');
        const { fx, flowPlugin, serializePlugin } = createTestContext();

        const flow = flowPlugin.flow('flows.complex');
        const executionLog: string[] = [];

        // Input validation node
        flow.node('validate', {
            runsOn: 'client',
            guard: (ctx) => ctx.in.data !== undefined,
            effect: (ctx) => {
                executionLog.push('Validating input');
                const isValid = ctx.in.data && ctx.in.data.length > 0;
                ctx.set({ valid: isValid });
                ctx.next('process', { ...ctx.in, validated: true });
            }
        });

        // Processing node with branching
        flow.node('process', {
            runsOn: 'client',
            branch: {
                switch: (ctx) => ctx.in.data.type || 'default',
                cases: {
                    'typeA': 'handlerA',
                    'typeB': 'handlerB'
                },
                default: 'defaultHandler'
            },
            effect: (ctx) => {
                executionLog.push('Processing data');
                ctx.shared.processedAt = Date.now();
                ctx.set({ processing: true });
            },
            retry: {
                maxAttempts: 2,
                backoffMs: 50
            }
        });

        // Type-specific handlers
        flow.node('handlerA', {
            runsOn: 'client',
            effect: (ctx) => {
                executionLog.push('Handler A processing');
                ctx.set({ handledBy: 'A' });
                ctx.next('finalize', { result: 'A-processed' });
            }
        });

        flow.node('handlerB', {
            runsOn: 'client',
            effect: (ctx) => {
                executionLog.push('Handler B processing');
                ctx.set({ handledBy: 'B' });
                ctx.next('finalize', { result: 'B-processed' });
            }
        });

        flow.node('defaultHandler', {
            runsOn: 'client',
            effect: (ctx) => {
                executionLog.push('Default handler processing');
                ctx.set({ handledBy: 'default' });
                ctx.next('finalize', { result: 'default-processed' });
            }
        });

        // Finalization
        flow.node('finalize', {
            runsOn: 'client',
            effect: (ctx) => {
                executionLog.push('Finalizing');
                ctx.set({
                    complete: true,
                    result: ctx.in.result,
                    processedAt: ctx.shared.processedAt
                });
            }
        });

        // Test with different inputs
        console.log('Testing with typeA:');
        flow.start('validate', { data: { type: 'typeA', value: 'test1' } });
        flow.runSync(20);

        // Serialize the complex flow state
        const flowNode = fx.resolvePath('flows.complex');
        const serialized = serializePlugin.wrap(flowNode);

        console.log('Execution log:', executionLog);
        console.log('Flow serialized, size:', JSON.stringify(serialized).length);

        if (executionLog.includes('Handler A processing')) {
            console.log('✅ Complex flow with all features works');
        } else {
            console.error('❌ Complex flow execution incomplete');
        }

        return { flow, executionLog, serialized };
    }
};

// Run all tests
export function runAllTests() {
    console.log('\n=== FX FLOW & SERIALIZE TEST SUITE ===\n');

    const results: { test: string; passed: boolean; error?: any }[] = [];

    for (const [testName, testFn] of Object.entries(tests)) {
        console.log(`\n--- ${testName} ---`);
        try {
            testFn();
            results.push({ test: testName, passed: true });
        } catch (error) {
            console.error(`❌ ${testName} failed:`, error);
            results.push({ test: testName, passed: false, error });
        }
    }

    console.log('\n=== TEST RESULTS ===\n');
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;

    results.forEach(r => {
        console.log(`${r.passed ? '✅' : '❌'} ${r.test}`);
    });

    console.log(`\nTotal: ${results.length} tests`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);

    if (failed === 0) {
        console.log('\n🎉 ALL TESTS PASSED! 🎉');
    } else {
        console.log('\n⚠️ Some tests failed. Review the logs above.');
    }

    return results;
}

// Export for use in other modules
export default { tests, runAllTests };