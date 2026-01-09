/**
 * Status Toast - Shows temporary status messages
 */

export class StatusToast {
    private container: HTMLElement;

    constructor() {
        this.container = this.createContainer();
    }

    /**
     * Create toast container
     */
    private createContainer(): HTMLElement {
        const container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            display: flex;
            flex-direction: column;
            gap: 10px;
            z-index: 10000;
            pointer-events: none;
        `;
        document.body.appendChild(container);
        return container;
    }

    /**
     * Show a toast message
     */
    show(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info', duration: number = 3000): void {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        const colors = {
            info: '#3b82f6',
            success: '#10b981',
            warning: '#f59e0b',
            error: '#ef4444'
        };

        toast.style.cssText = `
            background: var(--surface, #1e293b);
            border-left: 4px solid ${colors[type]};
            color: var(--text, #f1f5f9);
            padding: 12px 16px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            font-size: 14px;
            min-width: 200px;
            max-width: 400px;
            animation: slideIn 0.3s ease;
            pointer-events: auto;
        `;

        toast.textContent = message;
        this.container.appendChild(toast);

        // Auto-remove after duration
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, duration);
    }

    /**
     * Show success message
     */
    success(message: string): void {
        this.show(message, 'success');
    }

    /**
     * Show error message
     */
    error(message: string): void {
        this.show(message, 'error');
    }

    /**
     * Show info message
     */
    info(message: string): void {
        this.show(message, 'info');
    }

    /**
     * Show warning message
     */
    warning(message: string): void {
        this.show(message, 'warning');
    }
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }

    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
