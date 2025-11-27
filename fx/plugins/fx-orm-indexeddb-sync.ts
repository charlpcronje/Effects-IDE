/**
 * FX ORM IndexedDB Sync Adapter
 * Synchronous IndexedDB adapter for fx-orm using FX_SUSPEND pattern
 *
 * @version 2.0.0
 */

import type { FXCore, FXNodeProxy } from '../fx.v4';

// Get FXSuspend from global
const FXSuspend = (globalThis as any).FXSuspend;

interface QueryCondition {
  field: string;
  operator: string;
  value: any;
}

interface ParsedQuery {
  action: string;
  conditions: QueryCondition[];
  limit?: number;
  offset?: number;
  orderBy?: { field: string; direction: string };
  includes: string[];
}

/**
 * IndexedDB Sync Adapter - NO ASYNC
 * Extends BaseAdapter from fx-orm.ts
 */
export class IndexedDBSyncAdapter {
  private db: IDBDatabase | null = null;
  private dbName: string;
  private version: number = 1;
  protected connectionString: string;
  protected isConnected = false;
  protected tables: string[] = [];

  // Cache for synchronous operations
  private cache: Map<string, any> = new Map();
  private pendingOps: Map<string, Promise<any>> = new Map();

  constructor(connectionString: string) {
    this.connectionString = connectionString;
    // Extract database name from connection string
    // Format: "indexeddb://dbname" or just "dbname"
    this.dbName = connectionString.replace(/^indexeddb:\/\//, '') || 'fx-orm-db';
  }

  /**
   * Connect to IndexedDB - SYNCHRONOUS with FX_SUSPEND
   */
  connect(): void {
    if (this.isConnected && this.db) return;

    const cacheKey = `connect:${this.dbName}`;
    if (this.cache.has(cacheKey)) {
      this.db = this.cache.get(cacheKey);
      this.isConnected = true;
      return;
    }

    // Check if operation is already pending
    if (this.pendingOps.has(cacheKey)) {
      throw new FXSuspend(this.pendingOps.get(cacheKey));
    }

    // Start async operation
    const promise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        this.cache.set(cacheKey, db);
        this.pendingOps.delete(cacheKey);
        resolve(db);
      };

      request.onupgradeneeded = (event) => {
        const db = request.result;

        // Create default tables if they don't exist
        if (!db.objectStoreNames.contains('users')) {
          const users = db.createObjectStore('users', { keyPath: 'id', autoIncrement: true });
          users.createIndex('email', 'email', { unique: true });
          users.createIndex('status', 'status');
        }

        if (!db.objectStoreNames.contains('products')) {
          const products = db.createObjectStore('products', { keyPath: 'id', autoIncrement: true });
          products.createIndex('name', 'name');
          products.createIndex('price', 'price');
        }

        if (!db.objectStoreNames.contains('posts')) {
          const posts = db.createObjectStore('posts', { keyPath: 'id', autoIncrement: true });
          posts.createIndex('user_id', 'user_id');
          posts.createIndex('created_at', 'created_at');
        }
      };
    });

    this.pendingOps.set(cacheKey, promise);

    // Throw suspension
    throw new FXSuspend(promise.then(db => {
      this.db = db;
      this.isConnected = true;
      this.tables = Array.from(db.objectStoreNames);
      return db;
    }));
  }

  /**
   * Disconnect from IndexedDB - SYNCHRONOUS
   */
  disconnect(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.isConnected = false;
      this.cache.clear();
      this.pendingOps.clear();
    }
  }

  /**
   * Execute query - SYNCHRONOUS with FX_SUSPEND
   */
  execute(sql: string, params: any[] = []): any {
    this.ensureConnected();

    // Parse SQL to determine operation
    const operation = this.parseSQL(sql, params);
    const cacheKey = `execute:${sql}:${JSON.stringify(params)}`;

    // Check cache
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    // Check if operation is pending
    if (this.pendingOps.has(cacheKey)) {
      throw new FXSuspend(this.pendingOps.get(cacheKey));
    }

    // Execute based on operation type
    switch (operation.type) {
      case 'SELECT':
        return this.executeSelect(operation, cacheKey);
      case 'INSERT':
        return this.executeInsert(operation, cacheKey);
      case 'UPDATE':
        return this.executeUpdate(operation, cacheKey);
      case 'DELETE':
        return this.executeDelete(operation, cacheKey);
      default:
        throw new Error(`Unsupported operation: ${operation.type}`);
    }
  }

  /**
   * Insert record - SYNCHRONOUS with FX_SUSPEND
   */
  insert(table: string, data: any): any {
    this.ensureConnected();

    const cacheKey = `insert:${table}:${JSON.stringify(data)}`;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    if (this.pendingOps.has(cacheKey)) {
      throw new FXSuspend(this.pendingOps.get(cacheKey));
    }

    const promise = new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(table, 'readwrite');
      const store = transaction.objectStore(table);

      // Add timestamps
      if (!data.created_at) {
        data.created_at = new Date().toISOString();
      }

      const request = store.add(data);

      request.onsuccess = () => {
        const result = { id: request.result, ...data };
        this.cache.set(cacheKey, result);
        this.pendingOps.delete(cacheKey);
        resolve(result);
      };

      request.onerror = () => {
        this.pendingOps.delete(cacheKey);
        reject(request.error);
      };
    });

    this.pendingOps.set(cacheKey, promise);
    throw new FXSuspend(promise);
  }

  /**
   * Update record - SYNCHRONOUS with FX_SUSPEND
   */
  update(table: string, data: any, where: any): any {
    this.ensureConnected();

    const cacheKey = `update:${table}:${JSON.stringify(data)}:${JSON.stringify(where)}`;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    if (this.pendingOps.has(cacheKey)) {
      throw new FXSuspend(this.pendingOps.get(cacheKey));
    }

    const promise = new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(table, 'readwrite');
      const store = transaction.objectStore(table);

      // First get the existing record
      const getRequest = store.get(where.id);

      getRequest.onsuccess = () => {
        const existing = getRequest.result;
        if (!existing) {
          this.pendingOps.delete(cacheKey);
          resolve(null);
          return;
        }

        // Merge data
        const updated = { ...existing, ...data, updated_at: new Date().toISOString() };
        const putRequest = store.put(updated);

        putRequest.onsuccess = () => {
          this.cache.set(cacheKey, updated);
          this.pendingOps.delete(cacheKey);
          resolve(updated);
        };

        putRequest.onerror = () => {
          this.pendingOps.delete(cacheKey);
          reject(putRequest.error);
        };
      };

      getRequest.onerror = () => {
        this.pendingOps.delete(cacheKey);
        reject(getRequest.error);
      };
    });

    this.pendingOps.set(cacheKey, promise);
    throw new FXSuspend(promise);
  }

  /**
   * Delete record - SYNCHRONOUS with FX_SUSPEND
   */
  delete(table: string, where: any): boolean {
    this.ensureConnected();

    const cacheKey = `delete:${table}:${JSON.stringify(where)}`;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    if (this.pendingOps.has(cacheKey)) {
      throw new FXSuspend(this.pendingOps.get(cacheKey));
    }

    const promise = new Promise<boolean>((resolve, reject) => {
      const transaction = this.db!.transaction(table, 'readwrite');
      const store = transaction.objectStore(table);

      const request = store.delete(where.id);

      request.onsuccess = () => {
        this.cache.set(cacheKey, true);
        this.pendingOps.delete(cacheKey);
        resolve(true);
      };

      request.onerror = () => {
        this.pendingOps.delete(cacheKey);
        reject(request.error);
      };
    });

    this.pendingOps.set(cacheKey, promise);
    throw new FXSuspend(promise);
  }

  /**
   * Get available tables
   */
  getTables(): string[] {
    if (!this.db) return [];
    return Array.from(this.db.objectStoreNames);
  }

  /**
   * Build SELECT query for IndexedDB
   */
  buildSelect(table: string, q: ParsedQuery): string {
    // Since IndexedDB doesn't use SQL, we'll return a pseudo-SQL for consistency
    let sql = `SELECT * FROM ${table}`;
    if (q.conditions.length) {
      sql += ` WHERE ` + q.conditions.map(c => {
        if (c.operator === "IN") {
          return `${c.field} IN (${Array.isArray(c.value) ? c.value.join(',') : c.value})`;
        }
        return `${c.field} ${c.operator} ${c.value}`;
      }).join(" AND ");
    }
    if (q.orderBy) sql += ` ORDER BY ${q.orderBy.field} ${q.orderBy.direction.toUpperCase()}`;
    if (q.limit) sql += ` LIMIT ${q.limit}`;
    if (q.offset) sql += ` OFFSET ${q.offset}`;
    return sql;
  }

  /**
   * Build parameters for query
   */
  buildParams(q: ParsedQuery): any[] {
    const params: any[] = [];
    for (const c of q.conditions) {
      if (c.operator === "IN" && Array.isArray(c.value)) {
        params.push(...c.value);
      } else {
        params.push(c.value);
      }
    }
    return params;
  }

  /* ============= Private Helper Methods ============= */

  private ensureConnected(): void {
    if (!this.isConnected || !this.db) {
      this.connect();
    }
  }

  private parseSQL(sql: string, params: any[]): any {
    const normalized = sql.trim().toUpperCase();

    if (normalized.startsWith('SELECT')) {
      return this.parseSelectSQL(sql, params);
    } else if (normalized.startsWith('INSERT')) {
      return this.parseInsertSQL(sql, params);
    } else if (normalized.startsWith('UPDATE')) {
      return this.parseUpdateSQL(sql, params);
    } else if (normalized.startsWith('DELETE')) {
      return this.parseDeleteSQL(sql, params);
    }

    return { type: 'UNKNOWN' };
  }

  private parseSelectSQL(sql: string, params: any[]): any {
    const match = sql.match(/FROM\s+(\w+)/i);
    const table = match ? match[1] : 'users';

    // Check for WHERE conditions
    const conditions: any[] = [];
    if (/WHERE\s+id\s*=\s*\?/i.test(sql) && params[0]) {
      conditions.push({ field: 'id', op: '=', value: params[0] });
    } else if (/WHERE\s+id\s+IN/i.test(sql)) {
      conditions.push({ field: 'id', op: 'IN', value: params });
    }

    // Check for LIMIT
    const limitMatch = sql.match(/LIMIT\s+(\d+)/i);
    const limit = limitMatch ? parseInt(limitMatch[1]) : undefined;

    return { type: 'SELECT', table, conditions, limit };
  }

  private parseInsertSQL(sql: string, params: any[]): any {
    const match = sql.match(/INTO\s+(\w+)/i);
    const table = match ? match[1] : 'users';
    return { type: 'INSERT', table, data: params[0] || {} };
  }

  private parseUpdateSQL(sql: string, params: any[]): any {
    const match = sql.match(/UPDATE\s+(\w+)/i);
    const table = match ? match[1] : 'users';
    return { type: 'UPDATE', table, data: params[0] || {}, where: params[1] || {} };
  }

  private parseDeleteSQL(sql: string, params: any[]): any {
    const match = sql.match(/FROM\s+(\w+)/i);
    const table = match ? match[1] : 'users';
    return { type: 'DELETE', table, where: params[0] || {} };
  }

  private executeSelect(operation: any, cacheKey: string): any {
    const { table, conditions, limit } = operation;

    const promise = new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(table, 'readonly');
      const store = transaction.objectStore(table);

      let request: IDBRequest;

      // Handle specific conditions
      if (conditions.length === 1 && conditions[0].field === 'id') {
        if (conditions[0].op === '=') {
          // Single record by ID
          request = store.get(conditions[0].value);
          request.onsuccess = () => {
            const result = request.result || null;
            this.cache.set(cacheKey, result);
            this.pendingOps.delete(cacheKey);
            resolve(result);
          };
        } else if (conditions[0].op === 'IN') {
          // Multiple records by IDs
          const ids = conditions[0].value;
          const results: any[] = [];
          let completed = 0;

          for (const id of ids) {
            const req = store.get(id);
            req.onsuccess = () => {
              if (req.result) results.push(req.result);
              completed++;
              if (completed === ids.length) {
                this.cache.set(cacheKey, results);
                this.pendingOps.delete(cacheKey);
                resolve(results);
              }
            };
          }
          return;
        }
      } else {
        // Get all records
        request = store.getAll(undefined, limit);
        request.onsuccess = () => {
          const results = request.result || [];
          this.cache.set(cacheKey, results);
          this.pendingOps.delete(cacheKey);
          resolve(results);
        };
      }

      request.onerror = () => {
        this.pendingOps.delete(cacheKey);
        reject(request.error);
      };
    });

    this.pendingOps.set(cacheKey, promise);
    throw new FXSuspend(promise);
  }

  private executeInsert(operation: any, cacheKey: string): any {
    return this.insert(operation.table, operation.data);
  }

  private executeUpdate(operation: any, cacheKey: string): any {
    return this.update(operation.table, operation.data, operation.where);
  }

  private executeDelete(operation: any, cacheKey: string): any {
    return this.delete(operation.table, operation.where);
  }
}

/**
 * Factory function to create IndexedDB adapter compatible with fx-orm
 */
export function createIndexedDBAdapter(connectionString: string): IndexedDBSyncAdapter {
  return new IndexedDBSyncAdapter(connectionString);
}

export default IndexedDBSyncAdapter;