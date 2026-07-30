import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[300px] p-8 rounded-xl border border-[#2a2d35] bg-[#1a1d24]">
          <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
            <AlertTriangle className="w-6 h-6 text-red-400" />
          </div>
          <h2 className="text-lg font-semibold text-[#e2e8f0] mb-2">页面出错了</h2>
          <p className="text-sm text-[#94a3b8] text-center max-w-md mb-4">
            {this.state.error?.message || '发生了意外错误'}
          </p>
          <div className="flex gap-3">
            <button
              onClick={this.handleReset}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2a2d35] text-[#e2e8f0] text-sm hover:bg-[#3a3d45] transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              重试
            </button>
            <button
              onClick={this.handleReload}
              className="px-4 py-2 rounded-lg bg-[#3b82f6] text-white text-sm hover:bg-[#2563eb] transition-colors"
            >
              刷新页面
            </button>
          </div>
          {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
            <details className="mt-4 w-full max-w-md">
              <summary className="text-xs text-[#64748b] cursor-pointer hover:text-[#94a3b8]">
                错误详情（开发模式）
              </summary>
              <pre className="mt-2 p-3 rounded bg-[#0f1117] text-xs text-red-300 overflow-auto max-h-40">
                {this.state.error?.stack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
