// /plugins/fx-analytics-beacon.ts
/**
 * @fx-plugin fx-analytics-beacon
 * @fx-global $analytics
 * @fx-description Observability aggregation, metrics, alerts, and health monitoring
 * @fx-dependencies
 * @fx-provides $analytics
 * @fx-version 1.0.0
 *
 * FX Analytics Beacon Plugin - Aggregates metrics from nodes, provides dashboards,
 * health checks, and observability features for the FX IDE.
 */

import type { FXCore, FXNodeProxy } from '../fx.v4';

// ============================================================================
// Types & Interfaces
// ============================================================================

export type MetricType = 'counter' | 'gauge' | 'histogram' | 'timer';

export interface Metric {
    name: string;
    type: MetricType;
    value: number;
    labels: Record<string, string>;
    timestamp: number;
    unit?: string;
}

export interface MetricDefinition {
    name: string;
    type: MetricType;
    description: string;
    unit?: string;
    labels?: string[];
    buckets?: number[]; // For histograms
}

export interface Alert {
    id: string;
    name: string;
    metric: string;
    condition: AlertCondition;
    severity: 'info' | 'warning' | 'error' | 'critical';
    message: string;
    enabled: boolean;
    lastTriggered?: number;
    status: 'ok' | 'firing' | 'pending';
}

export interface AlertCondition {
    operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
    threshold: number;
    duration?: number; // ms - condition must hold for this duration
}

export interface HealthCheck {
    id: string;
    name: string;
    check: () => HealthStatus;
    interval: number; // ms
    lastCheck?: number;
    status: HealthStatus;
}

export interface HealthStatus {
    healthy: boolean;
    message: string;
    details?: Record<string, any>;
}

export interface EventLog {
    id: string;
    timestamp: number;
    actor: string;
    action: string;
    payload: Record<string, any>;
    traceId?: string;
    severity: 'debug' | 'info' | 'warn' | 'error';
}

export interface DashboardConfig {
    id: string;
    name: string;
    panels: DashboardPanel[];
    refreshInterval: number;
}

export interface DashboardPanel {
    id: string;
    title: string;
    type: 'metric' | 'chart' | 'table' | 'alert' | 'health';
    metric?: string;
    query?: string;
    size: { w: number; h: number };
    position: { x: number; y: number };
}

export interface AnalyticsConfig {
    maxEvents?: number;
    maxMetricHistory?: number;
    flushInterval?: number;
    enableHealthChecks?: boolean;
    healthCheckInterval?: number;
    retentionPeriod?: number;
}

// ============================================================================
// Built-in Metrics
// ============================================================================

const BUILTIN_METRICS: MetricDefinition[] = [
    // Performance metrics
    { name: 'sync.latency', type: 'histogram', description: 'Visual-code sync latency', unit: 'ms', buckets: [5, 10, 25, 50, 100, 250, 500] },
    { name: 'scene.fps', type: 'gauge', description: 'Scene frames per second', unit: 'fps' },
    { name: 'plugins.loadTime', type: 'timer', description: 'Plugin load time', unit: 'ms' },
    { name: 'db.renderTime', type: 'timer', description: 'Database result render time', unit: 'ms' },

    // AI metrics
    { name: 'ai.turnaround', type: 'timer', description: 'AI request turnaround time', unit: 'ms' },
    { name: 'ai.tokensUsed', type: 'counter', description: 'Total AI tokens used' },
    { name: 'ai.requests', type: 'counter', description: 'Total AI requests' },

    // System metrics
    { name: 'memory.heap', type: 'gauge', description: 'Heap memory usage', unit: 'bytes' },
    { name: 'memory.external', type: 'gauge', description: 'External memory usage', unit: 'bytes' },
    { name: 'nodes.count', type: 'gauge', description: 'Total FX nodes' },
    { name: 'watchers.count', type: 'gauge', description: 'Active watchers' },

    // Operation counters
    { name: 'files.opened', type: 'counter', description: 'Files opened' },
    { name: 'files.saved', type: 'counter', description: 'Files saved' },
    { name: 'commands.executed', type: 'counter', description: 'Commands executed' },
    { name: 'errors.total', type: 'counter', description: 'Total errors' }
];

// ============================================================================
// Built-in Alerts
// ============================================================================

const BUILTIN_ALERTS: Omit<Alert, 'id'>[] = [
    {
        name: 'High Sync Latency',
        metric: 'sync.latency',
        condition: { operator: '>', threshold: 50, duration: 5000 },
        severity: 'warning',
        message: 'Visual-code sync latency exceeds 50ms',
        enabled: true,
        status: 'ok'
    },
    {
        name: 'Low FPS',
        metric: 'scene.fps',
        condition: { operator: '<', threshold: 60 },
        severity: 'warning',
        message: 'Scene FPS dropped below 60',
        enabled: true,
        status: 'ok'
    },
    {
        name: 'Critical FPS',
        metric: 'scene.fps',
        condition: { operator: '<', threshold: 30, duration: 3000 },
        severity: 'critical',
        message: 'Scene FPS critically low',
        enabled: true,
        status: 'ok'
    },
    {
        name: 'High Memory Usage',
        metric: 'memory.heap',
        condition: { operator: '>', threshold: 500 * 1024 * 1024 }, // 500MB
        severity: 'warning',
        message: 'Heap memory usage exceeds 500MB',
        enabled: true,
        status: 'ok'
    }
];

// ============================================================================
// Logger
// ============================================================================

class AnalyticsLogger {
    static log(level: string, message: string, data?: any): void {
        console.log(`[FX-ANALYTICS:${level.toUpperCase()}]`, message, data ?? '');
    }
    static info(message: string, data?: any): void { this.log('info', message, data); }
    static warn(message: string, data?: any): void { this.log('warn', message, data); }
    static error(message: string, data?: any): void { this.log('error', message, data); }
    static debug(message: string, data?: any): void { this.log('debug', message, data); }
}

// ============================================================================
// Analytics Beacon Plugin Class
// ============================================================================

export class FXAnalyticsBeacon {
    public readonly name = 'analytics-beacon';
    public readonly version = '1.0.0';
    public readonly description = 'Observability aggregation and health monitoring';

    private fx: FXCore;
    private config: AnalyticsConfig;

    private metrics = new Map<string, MetricDefinition>();
    private metricValues = new Map<string, Metric[]>();
    private alerts = new Map<string, Alert>();
    private healthChecks = new Map<string, HealthCheck>();
    private events: EventLog[] = [];
    private listeners = new Map<string, Set<Function>>();

    private flushInterval: NodeJS.Timeout | number | null = null;
    private healthInterval: NodeJS.Timeout | number | null = null;
    private alertCheckInterval: NodeJS.Timeout | number | null = null;

    constructor(fx: FXCore, config: AnalyticsConfig = {}) {
        this.fx = fx;
        this.config = {
            maxEvents: 10000,
            maxMetricHistory: 1000,
            flushInterval: 10000, // 10 seconds
            enableHealthChecks: true,
            healthCheckInterval: 30000, // 30 seconds
            retentionPeriod: 24 * 60 * 60 * 1000, // 24 hours
            ...config
        };

        this.initNodes();
        this.registerBuiltinMetrics();
        this.registerBuiltinAlerts();
        this.startCollectors();

        AnalyticsLogger.info('FX Analytics Beacon initialized');
    }

    // ========================================================================
    // Initialization
    // ========================================================================

    private initNodes(): void {
        const $$ = this.fx.proxy();

        $$('metrics').val({});
        $$('observability.events').val([]);
        $$('observability.alerts').val({});
        $$('observability.health').val({});
        $$('observability.stats').val({
            eventsCount: 0,
            metricsCount: 0,
            alertsFiring: 0,
            healthyChecks: 0,
            unhealthyChecks: 0
        });
    }

    private registerBuiltinMetrics(): void {
        for (const metric of BUILTIN_METRICS) {
            this.registerMetric(metric);
        }
    }

    private registerBuiltinAlerts(): void {
        for (const alert of BUILTIN_ALERTS) {
            this.registerAlert(alert);
        }
    }

    private startCollectors(): void {
        // Flush interval
        this.flushInterval = setInterval(() => {
            this.flush();
        }, this.config.flushInterval!);

        // Health check interval
        if (this.config.enableHealthChecks) {
            this.healthInterval = setInterval(() => {
                this.runHealthChecks();
            }, this.config.healthCheckInterval!);
        }

        // Alert check interval
        this.alertCheckInterval = setInterval(() => {
            this.checkAlerts();
        }, 1000); // Check every second

        // Collect system metrics
        this.startSystemMetrics();
    }

    private startSystemMetrics(): void {
        // Memory metrics
        setInterval(() => {
            if ('performance' in globalThis && (performance as any).memory) {
                const memory = (performance as any).memory;
                this.gauge('memory.heap', memory.usedJSHeapSize);
            }
        }, 5000);
    }

    // ========================================================================
    // Metric Registration
    // ========================================================================

    /**
     * Register a metric definition
     */
    registerMetric(definition: MetricDefinition): void {
        this.metrics.set(definition.name, definition);
        this.metricValues.set(definition.name, []);

        const $$ = this.fx.proxy();
        $$(`metrics.${this.sanitizeKey(definition.name)}`).val({
            type: definition.type,
            description: definition.description,
            unit: definition.unit,
            current: null
        });

        AnalyticsLogger.debug(`Metric registered: ${definition.name}`);
    }

    // ========================================================================
    // Metric Recording
    // ========================================================================

    /**
     * Increment a counter
     */
    increment(name: string, value: number = 1, labels: Record<string, string> = {}): void {
        this.record(name, 'counter', value, labels);
    }

    /**
     * Set a gauge value
     */
    gauge(name: string, value: number, labels: Record<string, string> = {}): void {
        this.record(name, 'gauge', value, labels);
    }

    /**
     * Record a histogram value
     */
    histogram(name: string, value: number, labels: Record<string, string> = {}): void {
        this.record(name, 'histogram', value, labels);
    }

    /**
     * Record a timer value
     */
    timer(name: string, value: number, labels: Record<string, string> = {}): void {
        this.record(name, 'timer', value, labels);
    }

    /**
     * Start a timer and return a function to stop it
     */
    startTimer(name: string, labels: Record<string, string> = {}): () => number {
        const start = performance.now();
        return () => {
            const duration = performance.now() - start;
            this.timer(name, duration, labels);
            return duration;
        };
    }

    private record(name: string, type: MetricType, value: number, labels: Record<string, string>): void {
        const metric: Metric = {
            name,
            type,
            value,
            labels,
            timestamp: Date.now()
        };

        // Add to history
        let history = this.metricValues.get(name);
        if (!history) {
            history = [];
            this.metricValues.set(name, history);
        }

        // For counters, accumulate
        if (type === 'counter' && history.length > 0) {
            const last = history[history.length - 1];
            metric.value = last.value + value;
        }

        history.push(metric);

        // Trim history
        if (history.length > this.config.maxMetricHistory!) {
            history.shift();
        }

        // Update FX node
        const $$ = this.fx.proxy();
        $$(`metrics.${this.sanitizeKey(name)}.current`).val(metric.value);
        $$(`metrics.${this.sanitizeKey(name)}.lastUpdate`).val(metric.timestamp);

        // Emit event
        this.emit('metric', metric);
    }

    /**
     * Get current metric value
     */
    getMetric(name: string): number | null {
        const history = this.metricValues.get(name);
        if (!history || history.length === 0) return null;
        return history[history.length - 1].value;
    }

    /**
     * Get metric history
     */
    getMetricHistory(name: string, since?: number): Metric[] {
        const history = this.metricValues.get(name) || [];
        if (since) {
            return history.filter(m => m.timestamp >= since);
        }
        return [...history];
    }

    // ========================================================================
    // Event Logging
    // ========================================================================

    /**
     * Log an event
     */
    log(action: string, payload: Record<string, any> = {}, options: {
        actor?: string;
        severity?: EventLog['severity'];
        traceId?: string;
    } = {}): void {
        const event: EventLog = {
            id: `evt-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            timestamp: Date.now(),
            actor: options.actor || 'system',
            action,
            payload,
            traceId: options.traceId,
            severity: options.severity || 'info'
        };

        this.events.push(event);

        // Trim events
        while (this.events.length > this.config.maxEvents!) {
            this.events.shift();
        }

        // Update FX node (last 100 events)
        const $$ = this.fx.proxy();
        const recentEvents = this.events.slice(-100);
        $$('observability.events').val(recentEvents);

        // Emit event
        this.emit('event', event);

        AnalyticsLogger.debug(`Event: ${action}`, payload);
    }

    /**
     * Get events
     */
    getEvents(filter?: {
        action?: string;
        actor?: string;
        since?: number;
        severity?: EventLog['severity'];
    }): EventLog[] {
        let events = [...this.events];

        if (filter) {
            if (filter.action) {
                events = events.filter(e => e.action === filter.action);
            }
            if (filter.actor) {
                events = events.filter(e => e.actor === filter.actor);
            }
            if (filter.since) {
                events = events.filter(e => e.timestamp >= filter.since);
            }
            if (filter.severity) {
                events = events.filter(e => e.severity === filter.severity);
            }
        }

        return events;
    }

    // ========================================================================
    // Alerts
    // ========================================================================

    /**
     * Register an alert
     */
    registerAlert(alert: Omit<Alert, 'id'>): Alert {
        const id = `alert-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const newAlert: Alert = { ...alert, id };

        this.alerts.set(id, newAlert);

        const $$ = this.fx.proxy();
        $$(`observability.alerts.${id}`).val({
            name: newAlert.name,
            status: newAlert.status,
            severity: newAlert.severity
        });

        AnalyticsLogger.debug(`Alert registered: ${alert.name}`);

        return newAlert;
    }

    /**
     * Check all alerts
     */
    private checkAlerts(): void {
        for (const [id, alert] of this.alerts) {
            if (!alert.enabled) continue;

            const value = this.getMetric(alert.metric);
            if (value === null) continue;

            const conditionMet = this.evaluateCondition(value, alert.condition);

            if (conditionMet && alert.status !== 'firing') {
                this.fireAlert(alert);
            } else if (!conditionMet && alert.status === 'firing') {
                this.resolveAlert(alert);
            }
        }

        this.updateStats();
    }

    private evaluateCondition(value: number, condition: AlertCondition): boolean {
        switch (condition.operator) {
            case '>': return value > condition.threshold;
            case '<': return value < condition.threshold;
            case '>=': return value >= condition.threshold;
            case '<=': return value <= condition.threshold;
            case '==': return value === condition.threshold;
            case '!=': return value !== condition.threshold;
            default: return false;
        }
    }

    private fireAlert(alert: Alert): void {
        alert.status = 'firing';
        alert.lastTriggered = Date.now();

        AnalyticsLogger.warn(`Alert firing: ${alert.name}`, { metric: alert.metric, message: alert.message });

        this.emit('alert', { type: 'fire', alert });
        this.log('alert.fired', { alertId: alert.id, name: alert.name }, { severity: 'warn' });

        const $$ = this.fx.proxy();
        $$(`observability.alerts.${alert.id}.status`).val('firing');
    }

    private resolveAlert(alert: Alert): void {
        alert.status = 'ok';

        AnalyticsLogger.info(`Alert resolved: ${alert.name}`);

        this.emit('alert', { type: 'resolve', alert });
        this.log('alert.resolved', { alertId: alert.id, name: alert.name });

        const $$ = this.fx.proxy();
        $$(`observability.alerts.${alert.id}.status`).val('ok');
    }

    /**
     * Get all alerts
     */
    getAlerts(): Alert[] {
        return Array.from(this.alerts.values());
    }

    /**
     * Get firing alerts
     */
    getFiringAlerts(): Alert[] {
        return this.getAlerts().filter(a => a.status === 'firing');
    }

    // ========================================================================
    // Health Checks
    // ========================================================================

    /**
     * Register a health check
     */
    registerHealthCheck(name: string, check: () => HealthStatus, interval?: number): HealthCheck {
        const id = `health-${Date.now()}-${Math.random().toString(36).slice(2)}`;

        const healthCheck: HealthCheck = {
            id,
            name,
            check,
            interval: interval || this.config.healthCheckInterval!,
            status: { healthy: true, message: 'Not checked yet' }
        };

        this.healthChecks.set(id, healthCheck);

        AnalyticsLogger.debug(`Health check registered: ${name}`);

        return healthCheck;
    }

    /**
     * Run all health checks
     */
    private runHealthChecks(): void {
        for (const [id, check] of this.healthChecks) {
            try {
                check.status = check.check();
                check.lastCheck = Date.now();

                const $$ = this.fx.proxy();
                $$(`observability.health.${id}`).val({
                    name: check.name,
                    healthy: check.status.healthy,
                    message: check.status.message,
                    lastCheck: check.lastCheck
                });

                if (!check.status.healthy) {
                    AnalyticsLogger.warn(`Health check failed: ${check.name}`, check.status);
                    this.emit('healthCheck', { check, status: check.status });
                }
            } catch (e: any) {
                check.status = { healthy: false, message: e.message };
                AnalyticsLogger.error(`Health check error: ${check.name}`, e);
            }
        }

        this.updateStats();
    }

    /**
     * Get health status
     */
    getHealthStatus(): {
        overall: boolean;
        checks: Array<{ name: string; healthy: boolean; message: string }>;
    } {
        const checks = Array.from(this.healthChecks.values()).map(c => ({
            name: c.name,
            healthy: c.status.healthy,
            message: c.status.message
        }));

        return {
            overall: checks.every(c => c.healthy),
            checks
        };
    }

    // ========================================================================
    // Event System
    // ========================================================================

    /**
     * Subscribe to analytics events
     */
    on(event: string, callback: Function): () => void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event)!.add(callback);

        return () => this.off(event, callback);
    }

    /**
     * Unsubscribe from events
     */
    off(event: string, callback: Function): void {
        this.listeners.get(event)?.delete(callback);
    }

    private emit(event: string, data: any): void {
        const listeners = this.listeners.get(event);
        if (listeners) {
            for (const listener of listeners) {
                try {
                    listener(data);
                } catch (e) {
                    AnalyticsLogger.error(`Event listener error: ${event}`, e);
                }
            }
        }
    }

    // ========================================================================
    // Utilities
    // ========================================================================

    private sanitizeKey(key: string): string {
        return key.replace(/[.\/]/g, '_');
    }

    private flush(): void {
        // Cleanup old events
        const cutoff = Date.now() - this.config.retentionPeriod!;
        this.events = this.events.filter(e => e.timestamp >= cutoff);

        // Cleanup old metrics
        for (const [name, history] of this.metricValues) {
            const filtered = history.filter(m => m.timestamp >= cutoff);
            this.metricValues.set(name, filtered);
        }

        this.updateStats();
    }

    private updateStats(): void {
        const $$ = this.fx.proxy();

        const firingAlerts = this.getFiringAlerts().length;
        const checks = Array.from(this.healthChecks.values());
        const healthyChecks = checks.filter(c => c.status.healthy).length;

        $$('observability.stats').val({
            eventsCount: this.events.length,
            metricsCount: this.metrics.size,
            alertsFiring: firingAlerts,
            healthyChecks,
            unhealthyChecks: checks.length - healthyChecks
        });
    }

    /**
     * Export metrics in Prometheus format
     */
    exportPrometheus(): string {
        const lines: string[] = [];

        for (const [name, history] of this.metricValues) {
            if (history.length === 0) continue;

            const metric = history[history.length - 1];
            const def = this.metrics.get(name);

            if (def) {
                lines.push(`# HELP ${name} ${def.description}`);
                lines.push(`# TYPE ${name} ${def.type}`);
            }

            const labels = Object.entries(metric.labels)
                .map(([k, v]) => `${k}="${v}"`)
                .join(',');

            const labelStr = labels ? `{${labels}}` : '';
            lines.push(`${name}${labelStr} ${metric.value}`);
        }

        return lines.join('\n');
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        if (this.flushInterval) clearInterval(this.flushInterval as number);
        if (this.healthInterval) clearInterval(this.healthInterval as number);
        if (this.alertCheckInterval) clearInterval(this.alertCheckInterval as number);

        this.listeners.clear();
        AnalyticsLogger.info('FX Analytics Beacon disposed');
    }
}

// ============================================================================
// Plugin Export
// ============================================================================

export default function(fx: FXCore, config: AnalyticsConfig = {}): FXAnalyticsBeacon {
    return new FXAnalyticsBeacon(fx, config);
}
