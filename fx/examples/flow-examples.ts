/**
 * FX Flow Real-World Examples
 * Demonstrates practical use cases for flow execution and serialization
 */

import type { FXCore } from '../fx.v4';
import type { FXFlowPlugin, FlowAPI } from '../plugins/fx-flow';
import type { FXSerializePlugin } from '../plugins/fx-serialize';

/**
 * Example 1: E-commerce Order Processing Flow
 * A complete order flow with validation, payment, inventory, and fulfillment
 */
export function createOrderProcessingFlow(flowPlugin: FXFlowPlugin): FlowAPI {
    const flow = flowPlugin.flow('flows.orderProcessing');

    // Step 1: Validate Order
    flow.node('validateOrder', {
        runsOn: 'client',
        effect: (ctx) => {
            const order = ctx.in;
            ctx.log('Validating order:', order.orderId);

            const errors = [];
            if (!order.items || order.items.length === 0) {
                errors.push('No items in order');
            }
            if (!order.customer || !order.customer.email) {
                errors.push('Invalid customer information');
            }
            if (order.total <= 0) {
                errors.push('Invalid order total');
            }

            if (errors.length > 0) {
                ctx.error('Validation failed:', errors);
                ctx.next('orderFailed', { reason: 'validation', errors });
            } else {
                ctx.set({ validated: true, timestamp: Date.now() });
                ctx.next('checkInventory', order);
            }
        }
    });

    // Step 2: Check Inventory
    flow.node('checkInventory', {
        runsOn: 'server', // Server-side inventory check
        effect: (ctx) => {
            const order = ctx.in;
            ctx.log('Checking inventory for', order.items.length, 'items');

            // Simulate inventory check
            const outOfStock = order.items.filter((item: any) => {
                // Mock check - randomly mark some items as out of stock
                return Math.random() > 0.8;
            });

            if (outOfStock.length > 0) {
                ctx.warn('Out of stock items:', outOfStock);
                ctx.next('handleBackorder', { order, outOfStock });
            } else {
                ctx.set({ inventoryChecked: true, allInStock: true });
                ctx.next('processPayment', order);
            }
        },
        retry: {
            maxAttempts: 3,
            backoffMs: 1000,
            multiplier: 2
        }
    });

    // Step 3: Handle Backorder
    flow.node('handleBackorder', {
        runsOn: 'client',
        effect: (ctx) => {
            const { order, outOfStock } = ctx.in;
            ctx.log('Handling backorder for', outOfStock.length, 'items');

            // Create backorder record
            ctx.shared.backorder = {
                orderId: order.orderId,
                items: outOfStock,
                estimatedDate: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
            };

            // Remove out of stock items from main order
            order.items = order.items.filter((item: any) =>
                !outOfStock.some((oos: any) => oos.sku === item.sku)
            );

            if (order.items.length > 0) {
                ctx.next('processPayment', order);
            } else {
                ctx.next('orderFailed', { reason: 'all_items_backordered' });
            }

            ctx.set({ backorderCreated: true });
        }
    });

    // Step 4: Process Payment
    flow.node('processPayment', {
        runsOn: 'server', // Secure payment processing on server
        effect: (ctx) => {
            const order = ctx.in;
            ctx.log('Processing payment for $', order.total);

            // Simulate payment processing with FX_SUSPEND
            if (typeof window !== 'undefined') {
                const paymentPromise = new Promise((resolve) => {
                    setTimeout(() => {
                        resolve({
                            success: Math.random() > 0.1, // 90% success rate
                            transactionId: `TXN_${Date.now()}`
                        });
                    }, 1000);
                });

                // Use FX_SUSPEND pattern for async operation
                throw new (globalThis as any).FXSuspend(paymentPromise);
            }

            // Simulated payment result
            const paymentResult = {
                success: Math.random() > 0.1,
                transactionId: `TXN_${Date.now()}`
            };

            if (paymentResult.success) {
                ctx.shared.payment = paymentResult;
                ctx.set({ paymentProcessed: true, transactionId: paymentResult.transactionId });
                ctx.next('createShipment', order);
            } else {
                ctx.next('paymentFailed', { order, error: 'Payment declined' });
            }
        },
        retry: {
            maxAttempts: 2,
            backoffMs: 2000
        }
    });

    // Step 5: Payment Failed Handler
    flow.node('paymentFailed', {
        runsOn: 'client',
        effect: (ctx) => {
            const { order, error } = ctx.in;
            ctx.error('Payment failed:', error);

            // Send notification to customer
            ctx.set({
                status: 'payment_failed',
                error,
                timestamp: Date.now()
            });

            // Could trigger retry flow or alternative payment
            ctx.next('notifyCustomer', {
                type: 'payment_failed',
                order,
                error
            });
        }
    });

    // Step 6: Create Shipment
    flow.node('createShipment', {
        runsOn: 'server',
        effect: (ctx) => {
            const order = ctx.in;
            ctx.log('Creating shipment for order', order.orderId);

            const shipment = {
                shipmentId: `SHIP_${Date.now()}`,
                orderId: order.orderId,
                trackingNumber: `TRACK_${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
                carrier: 'FedEx',
                estimatedDelivery: Date.now() + 3 * 24 * 60 * 60 * 1000, // 3 days
                items: order.items,
                address: order.shippingAddress
            };

            ctx.shared.shipment = shipment;
            ctx.set({ shipmentCreated: true, shipment });
            ctx.next('updateInventory', { order, shipment });
        }
    });

    // Step 7: Update Inventory
    flow.node('updateInventory', {
        runsOn: 'server',
        effect: (ctx) => {
            const { order } = ctx.in;
            ctx.log('Updating inventory for', order.items.length, 'items');

            // Simulate inventory update
            order.items.forEach((item: any) => {
                ctx.log(`Reducing inventory for ${item.sku} by ${item.quantity}`);
            });

            ctx.set({ inventoryUpdated: true, timestamp: Date.now() });
            ctx.next('notifyCustomer', {
                type: 'order_confirmed',
                order,
                shipment: ctx.shared.shipment,
                payment: ctx.shared.payment
            });
        }
    });

    // Step 8: Notify Customer
    flow.node('notifyCustomer', {
        runsOn: 'client',
        effect: (ctx) => {
            const { type, order, shipment, payment } = ctx.in;
            ctx.log('Sending notification:', type);

            const notification = {
                type,
                orderId: order.orderId,
                customer: order.customer,
                timestamp: Date.now(),
                details: {}
            };

            switch (type) {
                case 'order_confirmed':
                    notification.details = {
                        message: 'Your order has been confirmed and will ship soon!',
                        trackingNumber: shipment?.trackingNumber,
                        estimatedDelivery: shipment?.estimatedDelivery,
                        transactionId: payment?.transactionId
                    };
                    break;
                case 'payment_failed':
                    notification.details = {
                        message: 'Payment could not be processed. Please try again.',
                        error: ctx.in.error
                    };
                    break;
                default:
                    notification.details = { message: 'Order update' };
            }

            // In real app, would send email/SMS here
            ctx.log('Notification sent:', notification);
            ctx.set({ notificationSent: true, notification });

            if (type === 'order_confirmed') {
                ctx.next('orderComplete', { order, shipment, payment });
            }
        }
    });

    // Step 9: Order Complete
    flow.node('orderComplete', {
        runsOn: 'client',
        effect: (ctx) => {
            const { order, shipment, payment } = ctx.in;
            ctx.log('Order processing complete!');

            const summary = {
                orderId: order.orderId,
                status: 'complete',
                completedAt: Date.now(),
                transactionId: payment.transactionId,
                trackingNumber: shipment.trackingNumber,
                estimatedDelivery: shipment.estimatedDelivery,
                backorder: ctx.shared.backorder || null
            };

            ctx.set(summary);
            ctx.log('Order summary:', summary);
        }
    });

    // Step 10: Order Failed Handler
    flow.node('orderFailed', {
        runsOn: 'client',
        effect: (ctx) => {
            const { reason, errors } = ctx.in;
            ctx.error('Order failed:', reason, errors);

            ctx.set({
                status: 'failed',
                reason,
                errors,
                timestamp: Date.now()
            });
        }
    });

    // Connect the flow
    flow.connect('validateOrder', 'checkInventory', 'orderFailed');
    flow.connect('checkInventory', 'processPayment', 'handleBackorder');
    flow.connect('handleBackorder', 'processPayment', 'orderFailed');
    flow.connect('processPayment', 'createShipment', 'paymentFailed');
    flow.connect('paymentFailed', 'notifyCustomer');
    flow.connect('createShipment', 'updateInventory');
    flow.connect('updateInventory', 'notifyCustomer');
    flow.connect('notifyCustomer', 'orderComplete');

    return flow;
}

/**
 * Example 2: Data Pipeline Flow
 * ETL (Extract, Transform, Load) pipeline with error handling and checkpoints
 */
export function createDataPipelineFlow(flowPlugin: FXFlowPlugin): FlowAPI {
    const flow = flowPlugin.flow('flows.dataPipeline');

    // Extract data from multiple sources
    flow.node('extract', {
        runsOn: 'server',
        effect: (ctx) => {
            const { sources } = ctx.in;
            ctx.log('Extracting data from', sources.length, 'sources');

            const extractedData = sources.map((source: any) => ({
                source: source.name,
                records: Math.floor(Math.random() * 1000) + 100,
                timestamp: Date.now()
            }));

            ctx.shared.extractionStart = Date.now();
            ctx.set({ extracted: true, data: extractedData });
            ctx.next('validate', { data: extractedData });
        },
        retry: {
            maxAttempts: 3,
            backoffMs: 5000
        }
    });

    // Validate extracted data
    flow.node('validate', {
        runsOn: 'client',
        effect: (ctx) => {
            const { data } = ctx.in;
            ctx.log('Validating', data.length, 'data sources');

            const validData = [];
            const invalidData = [];

            data.forEach((item: any) => {
                if (item.records > 0) {
                    validData.push(item);
                } else {
                    invalidData.push(item);
                }
            });

            if (invalidData.length > 0) {
                ctx.warn('Invalid data found:', invalidData);
            }

            ctx.set({ validated: true, validCount: validData.length });

            if (validData.length > 0) {
                ctx.next('transform', { data: validData });
            }
            if (invalidData.length > 0) {
                ctx.next('handleInvalid', { data: invalidData });
            }
        }
    });

    // Transform data
    flow.node('transform', {
        runsOn: 'server',
        effect: (ctx) => {
            const { data } = ctx.in;
            ctx.log('Transforming', data.length, 'data batches');

            const transformed = data.map((item: any) => ({
                ...item,
                processed: true,
                transformedAt: Date.now(),
                recordsProcessed: item.records * 0.95, // Simulate some data loss
                format: 'normalized'
            }));

            ctx.shared.transformCount = transformed.reduce((sum: number, item: any) =>
                sum + item.recordsProcessed, 0
            );

            ctx.set({ transformed: true, data: transformed });
            ctx.next('aggregate', { data: transformed });
        }
    });

    // Aggregate transformed data
    flow.node('aggregate', {
        runsOn: 'client',
        effect: (ctx) => {
            const { data } = ctx.in;
            ctx.log('Aggregating', data.length, 'data batches');

            const aggregated = {
                totalRecords: data.reduce((sum: number, item: any) =>
                    sum + item.recordsProcessed, 0
                ),
                sources: data.length,
                startTime: ctx.shared.extractionStart,
                endTime: Date.now(),
                duration: Date.now() - ctx.shared.extractionStart
            };

            ctx.set({ aggregated: true, summary: aggregated });
            ctx.next('load', { data, summary: aggregated });
        }
    });

    // Load data to destination
    flow.node('load', {
        runsOn: 'server',
        effect: (ctx) => {
            const { data, summary } = ctx.in;
            ctx.log('Loading', summary.totalRecords, 'records');

            // Simulate loading to database
            const loadResult = {
                success: true,
                recordsLoaded: summary.totalRecords,
                destination: 'primary_db',
                timestamp: Date.now(),
                batchId: `BATCH_${Date.now()}`
            };

            ctx.set({ loaded: true, result: loadResult });
            ctx.next('checkpoint', { loadResult, summary });
        },
        retry: {
            maxAttempts: 5,
            backoffMs: 10000,
            multiplier: 1.5
        }
    });

    // Create checkpoint for recovery
    flow.node('checkpoint', {
        runsOn: 'client',
        effect: (ctx) => {
            const { loadResult, summary } = ctx.in;
            ctx.log('Creating checkpoint');

            const checkpoint = {
                id: `CHKPT_${Date.now()}`,
                batchId: loadResult.batchId,
                records: loadResult.recordsLoaded,
                duration: summary.duration,
                timestamp: Date.now(),
                canResume: true
            };

            ctx.shared.lastCheckpoint = checkpoint;
            ctx.set({ checkpoint });
            ctx.next('complete', { checkpoint, summary });
        }
    });

    // Handle invalid data
    flow.node('handleInvalid', {
        runsOn: 'client',
        effect: (ctx) => {
            const { data } = ctx.in;
            ctx.warn('Handling', data.length, 'invalid data items');

            // Log invalid data for manual review
            ctx.set({
                invalidHandled: true,
                items: data,
                action: 'logged_for_review'
            });
        }
    });

    // Pipeline complete
    flow.node('complete', {
        runsOn: 'client',
        effect: (ctx) => {
            const { checkpoint, summary } = ctx.in;
            ctx.log('Pipeline complete!');

            const report = {
                status: 'success',
                checkpointId: checkpoint.id,
                totalRecords: summary.totalRecords,
                duration: summary.duration,
                throughput: Math.round(summary.totalRecords / (summary.duration / 1000)),
                timestamp: Date.now()
            };

            ctx.set(report);
            ctx.log('Pipeline report:', report);
        }
    });

    return flow;
}

/**
 * Example 3: Workflow with Human Approval
 * Document approval workflow with multiple approval stages
 */
export function createApprovalWorkflow(
    flowPlugin: FXFlowPlugin,
    serializePlugin: FXSerializePlugin
): FlowAPI {
    const flow = flowPlugin.flow('flows.documentApproval');

    // Submit document
    flow.node('submit', {
        runsOn: 'client',
        effect: (ctx) => {
            const doc = ctx.in;
            ctx.log('Document submitted:', doc.title);

            ctx.shared.document = {
                ...doc,
                submittedAt: Date.now(),
                status: 'pending_review',
                approvals: []
            };

            ctx.set({ submitted: true });
            ctx.next('initialReview', ctx.shared.document);
        }
    });

    // Initial review
    flow.node('initialReview', {
        runsOn: 'client',
        guard: (ctx) => ctx.in.priority !== 'urgent', // Skip for urgent docs
        effect: (ctx) => {
            const doc = ctx.in;
            ctx.log('Initial review of:', doc.title);

            // Simulate review logic
            const reviewResult = {
                passed: Math.random() > 0.3,
                reviewer: 'system',
                timestamp: Date.now(),
                comments: 'Automated initial review'
            };

            if (reviewResult.passed) {
                ctx.shared.document.approvals.push(reviewResult);
                ctx.set({ reviewed: true, result: 'passed' });
                ctx.next('managerApproval', ctx.shared.document);
            } else {
                ctx.set({ reviewed: true, result: 'rejected' });
                ctx.next('revision', { document: doc, reason: 'Failed initial review' });
            }
        }
    });

    // Manager approval with branching based on amount
    flow.node('managerApproval', {
        runsOn: 'client',
        branch: {
            when: (ctx) => ctx.in.amount > 10000,
            then: 'executiveApproval',
            else: 'approved'
        },
        effect: (ctx) => {
            const doc = ctx.in;
            ctx.log('Manager reviewing:', doc.title, 'Amount:', doc.amount);

            // Save state for potential pause/resume
            const currentState = serializePlugin.wrap(ctx.shared);
            ctx.shared.savedState = currentState;

            // Simulate manager decision (in real app, would wait for input)
            const approval = {
                passed: Math.random() > 0.2,
                reviewer: 'manager_123',
                timestamp: Date.now(),
                comments: 'Reviewed by department manager'
            };

            if (approval.passed) {
                ctx.shared.document.approvals.push(approval);
                ctx.set({ approved: true, level: 'manager' });
                // Branch will determine next node
            } else {
                ctx.set({ approved: false, level: 'manager' });
                ctx.next('revision', { document: doc, reason: 'Manager rejected' });
            }
        }
    });

    // Executive approval for high-value items
    flow.node('executiveApproval', {
        runsOn: 'server', // Secure executive approval
        effect: (ctx) => {
            const doc = ctx.in;
            ctx.log('Executive reviewing high-value document:', doc.title);

            const approval = {
                passed: Math.random() > 0.1,
                reviewer: 'exec_001',
                timestamp: Date.now(),
                comments: 'Executive approval for high-value item'
            };

            if (approval.passed) {
                ctx.shared.document.approvals.push(approval);
                ctx.set({ approved: true, level: 'executive' });
                ctx.next('approved', ctx.shared.document);
            } else {
                ctx.set({ approved: false, level: 'executive' });
                ctx.next('rejected', { document: doc, reason: 'Executive rejected' });
            }
        }
    });

    // Document approved
    flow.node('approved', {
        runsOn: 'client',
        effect: (ctx) => {
            const doc = ctx.in;
            ctx.log('Document approved!', doc.title);

            const finalDoc = {
                ...doc,
                status: 'approved',
                approvedAt: Date.now(),
                approvalChain: doc.approvals || ctx.shared.document.approvals
            };

            ctx.set(finalDoc);
            ctx.next('archive', finalDoc);
        }
    });

    // Document rejected
    flow.node('rejected', {
        runsOn: 'client',
        effect: (ctx) => {
            const { document, reason } = ctx.in;
            ctx.log('Document rejected:', document.title, 'Reason:', reason);

            ctx.set({
                status: 'rejected',
                document,
                reason,
                timestamp: Date.now()
            });
        }
    });

    // Request revision
    flow.node('revision', {
        runsOn: 'client',
        effect: (ctx) => {
            const { document, reason } = ctx.in;
            ctx.log('Revision requested for:', document.title);

            ctx.set({
                status: 'revision_requested',
                document,
                reason,
                requestedAt: Date.now()
            });

            // Could trigger notification to submitter
            ctx.next('notifyRevision', { document, reason });
        }
    });

    // Notify about revision
    flow.node('notifyRevision', {
        runsOn: 'client',
        effect: (ctx) => {
            const { document, reason } = ctx.in;
            ctx.log('Notifying submitter about revision:', reason);

            ctx.set({
                notified: true,
                timestamp: Date.now()
            });
        }
    });

    // Archive approved document
    flow.node('archive', {
        runsOn: 'server',
        effect: (ctx) => {
            const doc = ctx.in;
            ctx.log('Archiving document:', doc.title);

            // Serialize the entire workflow state for audit
            const workflowState = serializePlugin.wrap(ctx.shared);

            const archived = {
                documentId: doc.id,
                archivedAt: Date.now(),
                location: 'primary_archive',
                workflowSnapshot: workflowState
            };

            ctx.set(archived);
            ctx.log('Document archived successfully');
        }
    });

    return flow;
}

/**
 * Utility function to demonstrate flow pause/resume with serialization
 */
export async function demonstratePauseResume(
    flowPlugin: FXFlowPlugin,
    serializePlugin: FXSerializePlugin
) {
    console.log('\n=== FLOW PAUSE/RESUME DEMONSTRATION ===\n');

    // Create and start a flow
    const flow = createOrderProcessingFlow(flowPlugin);

    // Start processing an order
    const testOrder = {
        orderId: 'ORD_12345',
        customer: {
            email: 'customer@example.com',
            name: 'John Doe'
        },
        items: [
            { sku: 'ITEM_001', name: 'Widget', quantity: 2, price: 29.99 },
            { sku: 'ITEM_002', name: 'Gadget', quantity: 1, price: 49.99 }
        ],
        total: 109.97,
        shippingAddress: {
            street: '123 Main St',
            city: 'Anytown',
            state: 'CA',
            zip: '12345'
        }
    };

    console.log('Starting order processing...');
    flow.start('validateOrder', testOrder);

    // Run for a few steps
    flow.runSync(3);

    // Serialize the current state
    console.log('\nSerializing flow state...');
    const serializedState = flow.serialize();
    console.log('Flow state serialized, size:', JSON.stringify(serializedState).length, 'bytes');

    // Simulate system restart - create new flow instance
    console.log('\nSimulating system restart...');
    const newFlow = flowPlugin.flow('flows.orderProcessing_restored');

    // Restore the state
    console.log('Restoring flow state...');
    newFlow.deserialize(serializedState);

    // Continue processing
    console.log('Continuing flow execution...');
    newFlow.runSync(10);

    console.log('\n=== DEMONSTRATION COMPLETE ===\n');
}

/**
 * Export all examples
 */
export default {
    createOrderProcessingFlow,
    createDataPipelineFlow,
    createApprovalWorkflow,
    demonstratePauseResume
};