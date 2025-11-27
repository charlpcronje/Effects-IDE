// /plugins/fx-react.ts
/**
 * @fx-plugin fx-react
 * @fx-global FXReact
 * @fx-description Seamless React hooks for FX reactive state management
 * @fx-dependencies $,$api
 * @fx-provides FXReact
 * @fx-version 2.0.0
 *
 * FX React Integration Plugin - Seamless React + FX integration
 *
 * Leverages the FX ecosystem:
 * - Uses FX core's built-in @/api/ support for data fetching
 * - Integrates with fx-dom-dollar for form handling
 * - Provides reactive hooks that sync with FX nodes
 * - Zero async contamination - maintains FX's synchronous principles
 */

import type { FXCore as FX, FXNodeProxy } from "../fx.v4";
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

type FXN = FXNodeProxy<any, any>;

interface ReactLoggerInterface {
  log(level: string, message: string, data?: any): void;
  error(message: string, error?: any): void;
  warn(message: string, data?: any): void;
  info(message: string, data?: any): void;
}

class ReactLogger implements ReactLoggerInterface {
  static log(level: string, message: string, data: any = {}): void {
    console.log(`[FX-REACT:${level.toUpperCase()}]`, message, data);
  }

  static error(message: string, error?: any): void {
    this.log('error', message, { error });
  }

  static warn(message: string, data?: any): void {
    this.log('warn', message, data);
  }

  static info(message: string, data?: any): void {
    this.log('info', message, data);
  }
}

interface FXReactOptions {
  autoCleanup?: boolean;
  devMode?: boolean;
}

interface APIOptions {
  dependencies?: any[];
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: any;
  headers?: Record<string, string>;
}

interface APIResponse<T = any> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

interface FormOptions {
  fxPath?: string;
  validate?: (values: any) => Promise<Record<string, string>> | Record<string, string>;
  onSubmit?: (values: any) => Promise<void> | void;
}

interface FormReturn {
  values: Record<string, any>;
  setValue: (name: string, value: any) => void;
  setValues: (values: Record<string, any>) => void;
  errors: Record<string, string>;
  setErrors: (errors: Record<string, string>) => void;
  isSubmitting: boolean;
  handleSubmit: (event?: React.FormEvent) => Promise<void>;
}

interface CacheOptions {
  namespace?: string;
  ttl?: number;
  dependencies?: any[];
}

interface CacheResponse<T = any> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

interface RouteInfo {
  currentRoute: string | null;
  params: Record<string, string>;
  navigate: (path: string) => void;
  router: any;
}

interface FXHooks {
  useFX: <T = any>(path: string, defaultValue?: T) => T;
  useFXSetter: (path: string) => (value: any) => void;
  useFXState: <T = any>(path: string, defaultValue?: T) => [T, (value: T) => void];
  useFXNode: (path: string) => FXN | null;
  useFXAPI: <T = any>(url: string, options?: APIOptions) => APIResponse<T>;
  useFXForm: (initialValues?: Record<string, any>, options?: FormOptions) => FormReturn;
  useFXLifecycle: (componentName: string, config?: any) => boolean;
  useFXCache: <T = any>(key: string, factory: () => Promise<T>, options?: CacheOptions) => CacheResponse<T>;
  useFXRouter: () => RouteInfo;
}

interface FXReactContext {
  FXProvider: React.ComponentType<React.PropsWithChildren<any>>;
  useFXContext: () => FX;
  FXContext: React.Context<FX>;
}

/**
 * @class FXReactPlugin
 * @description Seamless integration between FX and React using the FX ecosystem
 */
class FXReactPlugin {
  public readonly name = 'react';
  public readonly version = '2.0.0';
  public readonly description = 'Seamless React integration leveraging FX ecosystem';

  private fx: FX;
  private options: Required<FXReactOptions>;
  private componentRegistry = new WeakMap<any, string>();
  private hookSubscriptions = new Map<string, Set<() => void>>();

  public useFX!: FXHooks['useFX'];
  public useFXSetter!: FXHooks['useFXSetter'];
  public useFXState!: FXHooks['useFXState'];
  public useFXNode!: FXHooks['useFXNode'];
  public useFXAPI!: FXHooks['useFXAPI'];
  public useFXForm!: FXHooks['useFXForm'];
  public useFXLifecycle!: FXHooks['useFXLifecycle'];
  public useFXCache!: FXHooks['useFXCache'];
  public useFXRouter!: FXHooks['useFXRouter'];

  constructor(fx: FX, options: FXReactOptions = {}) {
    this.fx = fx;
    this.options = {
      autoCleanup: true,
      devMode: process.env.NODE_ENV === 'development',
      ...options
    };

    this.createHooks();
    ReactLogger.info('FX React integration initialized with ecosystem support');
  }

  private createHooks(): void {
    // Core FX hook - reactive state reading
    this.useFX = <T = any>(path: string, defaultValue?: T): T => {
      const [value, setValue] = useState<T>(() => {
        const node = this.fx.resolvePath(path, this.fx.root);
        return node ? this.fx.val(node) ?? defaultValue : defaultValue as T;
      });

      const pathRef = useRef(path);
      const unwatchRef = useRef<(() => void) | null>(null);

      useEffect(() => {
        pathRef.current = path;

        // Clean up previous watcher
        if (unwatchRef.current) {
          unwatchRef.current();
          unwatchRef.current = null;
        }

        // Set up new watcher using the public API
        const node = this.fx.resolvePath(path, this.fx.root);
        if (node) {
          // Use the proxy's watch method which returns a proper disposer
          const proxy = this.fx.createNodeProxy(node);
          unwatchRef.current = proxy.watch((newValue: T) => {
            if (pathRef.current === path) {
              setValue(newValue);
            }
          });

          // Update with current value
          const currentValue = this.fx.val(node);
          setValue(currentValue ?? defaultValue);
        }

        return () => {
          if (unwatchRef.current) {
            unwatchRef.current();
            unwatchRef.current = null;
          }
        };
      }, [path, defaultValue]);

      return value;
    };

    // FX setter hook
    this.useFXSetter = (path: string) => {
      return useCallback((value: any) => {
        const node = this.fx.resolvePath(path, this.fx.root);
        if (node) {
          this.fx.set(node, value);
        } else {
          this.fx.setPath(path, value, this.fx.root);
        }
      }, [path]);
    };

    // Combined hook (getter + setter)
    this.useFXState = <T = any>(path: string, defaultValue?: T): [T, (value: T) => void] => {
      const value = this.useFX<T>(path, defaultValue);
      const setValue = this.useFXSetter(path);
      return [value, setValue];
    };

    // FX node hook (returns the actual node)
    this.useFXNode = (path: string): FXN | null => {
      const [node, setNode] = useState<FXN | null>(() =>
        this.fx.resolvePath(path, this.fx.root)
      );

      useEffect(() => {
        const currentNode = this.fx.resolvePath(path, this.fx.root);
        setNode(currentNode);
      }, [path]);

      return node;
    };

    // API hook using FX core's built-in @/api/ support
    this.useFXAPI = <T = any>(url: string, options: APIOptions = {}): APIResponse<T> => {
      const {
        method = 'GET',
        body = null,
        headers = {},
        dependencies = []
      } = options;

      // Use FX core's built-in @/api/ syntax - maintains synchronous surface
      const apiPath = url.startsWith('/') ? url : `/${url}`;
      const apiNode = useMemo(() => {
        return (this.fx as any).$$(`@${apiPath}`);
      }, [apiPath]);

      // Make the API call using FX's native HTTP support
      const response = useMemo(() => {
        const requestArgs = { headers, ...(body && { body }) };

        switch (method.toUpperCase()) {
          case 'GET':
            return apiNode.get(requestArgs);
          case 'POST':
            return apiNode.post(requestArgs);
          case 'PUT':
            return apiNode.put(requestArgs);
          case 'PATCH':
            return apiNode.patch(requestArgs);
          case 'DELETE':
            return apiNode.delete(requestArgs);
          default:
            return apiNode.get(requestArgs);
        }
      }, [apiNode, method, JSON.stringify(body), JSON.stringify(headers), ...dependencies]);

      // Use FX reactive hooks to get response state
      const data = this.useFX<T>(`${response.__id}`, null);
      const loading = useMemo(() => {
        // FutureProxy is loading if data is not yet available
        return data === null || data === undefined;
      }, [data]);

      const [error, setError] = useState<Error | null>(null);

      // Watch for response errors
      useEffect(() => {
        if (response && typeof response === 'object' && 'error' in response) {
          setError(response.error);
        } else {
          setError(null);
        }
      }, [response]);

      return { data, loading, error };
    };

    // Form hook with FX integration using fx-dom-dollar
    this.useFXForm = (initialValues: Record<string, any> = {}, options: FormOptions = {}): FormReturn => {
      const {
        fxPath = null,
        validate = null,
        onSubmit = null
      } = options;

      const [values, setValues] = useState<Record<string, any>>(initialValues);
      const [errors, setErrors] = useState<Record<string, string>>({});
      const [isSubmitting, setIsSubmitting] = useState(false);

      // Sync with FX if path provided
      useEffect(() => {
        if (fxPath) {
          const node = this.fx.resolvePath(fxPath, this.fx.root);
          if (node) {
            const fxValues = this.fx.val(node);
            if (fxValues && typeof fxValues === 'object') {
              setValues(prev => ({ ...prev, ...fxValues }));
            }
          }
        }
      }, [fxPath]);

      const setValue = useCallback((name: string, value: any) => {
        setValues(prev => {
          const newValues = { ...prev, [name]: value };

          // Update FX if path provided
          if (fxPath) {
            this.fx.setPath(fxPath, newValues, this.fx.root);
          }

          return newValues;
        });
      }, [fxPath]);

      const handleSubmit = useCallback(async (event?: React.FormEvent) => {
        if (event) event.preventDefault();

        setIsSubmitting(true);
        setErrors({});

        try {
          // Validate if validator provided
          if (validate) {
            const validationErrors = await validate(values);
            if (Object.keys(validationErrors).length > 0) {
              setErrors(validationErrors);
              return;
            }
          }

          // Submit if handler provided
          if (onSubmit) {
            await onSubmit(values);
          }
        } catch (error) {
          setErrors({ submit: (error as Error).message });
        } finally {
          setIsSubmitting(false);
        }
      }, [values, validate, onSubmit]);

      return {
        values,
        setValue,
        setValues,
        errors,
        setErrors,
        isSubmitting,
        handleSubmit
      };
    };

    // Component lifecycle hook with FX
    this.useFXLifecycle = (componentName: string, config: any = {}): boolean => {
      const mountedRef = useRef(false);

      useEffect(() => {
        if (!mountedRef.current) {
          mountedRef.current = true;

          // Component mounted - register with FX
          const fxPath = `react.components.${componentName}`;
          this.fx.setPath(fxPath, {
            mounted: true,
            config,
            mountTime: Date.now()
          }, this.fx.root);

          ReactLogger.info(`React component mounted: ${componentName}`);

          return () => {
            // Component unmounting - cleanup FX
            const node = this.fx.resolvePath(fxPath, this.fx.root);
            if (node) {
              this.fx.set(node, {
                mounted: false,
                unmountTime: Date.now()
              });
            }

            ReactLogger.info(`React component unmounted: ${componentName}`);
          };
        }
      }, [componentName]);

      return mountedRef.current;
    };

    // Cache hook with FX cache integration
    this.useFXCache = <T = any>(key: string, factory: () => Promise<T>, options: CacheOptions = {}): CacheResponse<T> => {
      const [data, setData] = useState<T | null>(null);
      const [loading, setLoading] = useState(true);
      const [error, setError] = useState<Error | null>(null);

      const {
        namespace = 'react',
        ttl = 300000, // 5 minutes
        dependencies = []
      } = options;

      useEffect(() => {
        const loadData = async () => {
          try {
            setLoading(true);
            setError(null);

            // Try to use fx-cache plugin if available
            const cache = (this.fx as any).pluginManager?.getByPrefix('cache');
            if (cache) {
              const cachedData = await cache.getOrSet(key, factory, {
                namespace,
                ttl
              });
              setData(cachedData);
            } else {
              // No cache, run factory directly
              const freshData = await factory();
              setData(freshData);
            }
          } catch (err) {
            setError(err as Error);
          } finally {
            setLoading(false);
          }
        };

        loadData();
      }, [key, namespace, ttl, ...dependencies]);

      return { data, loading, error };
    };

    // Router integration hook
    this.useFXRouter = (): RouteInfo => {
      const router = (this.fx as any).pluginManager?.getByPrefix('router');
      const [currentRoute, setCurrentRoute] = useState<string | null>(
        router ? router.getCurrentRoute() : null
      );
      const [params, setParams] = useState<Record<string, string>>(
        router ? router.getCurrentParams() : {}
      );

      useEffect(() => {
        if (!router) return;

        const handleNavigation = (event: CustomEvent) => {
          setCurrentRoute(event.detail.route);
          setParams(event.detail.params);
        };

        document.addEventListener('fx:navigate', handleNavigation as EventListener);

        return () => {
          document.removeEventListener('fx:navigate', handleNavigation as EventListener);
        };
      }, [router]);

      const navigate = useCallback((path: string) => {
        if (router) {
          router.navigate(path);
        }
      }, [router]);

      return {
        currentRoute,
        params,
        navigate,
        router
      };
    };
  }

  // HOC for automatic FX integration
  public withFX = <P extends object>(WrappedComponent: React.ComponentType<P>, fxPath: string) => {
    return function FXEnhancedComponent(props: P) {
      const fxData = this.useFX(fxPath);
      const setFXData = this.useFXSetter(fxPath);

      return React.createElement(WrappedComponent, {
        ...props,
        fxData,
        setFXData,
        fx: this.fx
      } as P);
    }.bind(this);
  };

  // Provider component for FX context
  public createProvider(): FXReactContext {
    const FXContext = React.createContext<FX>(this.fx);

    const FXProvider: React.FC<React.PropsWithChildren<any>> = ({ children, ...props }) => {
      return React.createElement(FXContext.Provider, {
        value: this.fx,
        ...props
      }, children);
    };

    const useFXContext = (): FX => {
      const context = React.useContext(FXContext);
      if (!context) {
        throw new Error('useFXContext must be used within an FXProvider');
      }
      return context;
    };

    return { FXProvider, useFXContext, FXContext };
  }

  // Get all hooks for export
  public getHooks(): FXHooks {
    return {
      useFX: this.useFX,
      useFXSetter: this.useFXSetter,
      useFXState: this.useFXState,
      useFXNode: this.useFXNode,
      useFXAPI: this.useFXAPI,
      useFXForm: this.useFXForm,
      useFXLifecycle: this.useFXLifecycle,
      useFXCache: this.useFXCache,
      useFXRouter: this.useFXRouter
    };
  }
}

// Plugin factory function
export default function fxReactPlugin(fx: FX, options?: FXReactOptions) {
  const plugin = new FXReactPlugin(fx, options);

  // Export hooks globally for easy import
  const hooks = plugin.getHooks();
  const { FXProvider, useFXContext } = plugin.createProvider();

  // Make available globally
  if (typeof globalThis !== 'undefined') {
    (globalThis as any).FXReact = {
      ...hooks,
      FXProvider,
      useFXContext,
      withFX: plugin.withFX
    };
  }

  return {
    ...hooks,
    FXProvider,
    useFXContext,
    withFX: plugin.withFX,
    plugin
  };
}

// Export plugin for direct imports
export { FXReactPlugin, type FXHooks, type FXReactOptions };