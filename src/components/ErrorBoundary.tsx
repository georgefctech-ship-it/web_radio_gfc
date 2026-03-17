import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0F0F0F] text-white flex flex-col items-center justify-center p-6 text-center">
          <div className="max-w-md space-y-8">
            <div className="size-24 bg-red-500/10 rounded-[40px] flex items-center justify-center mx-auto border border-red-500/20">
              <AlertTriangle className="size-12 text-red-500" />
            </div>
            
            <div className="space-y-4">
              <h1 className="text-4xl font-black uppercase tracking-tighter">Ops! Algo correu mal</h1>
              <p className="text-gray-400 font-medium">
                Ocorreu um erro inesperado na aplicação. Estamos a trabalhar para resolver o problema.
              </p>
              {this.state.error && (
                <div className="p-4 bg-white/5 rounded-2xl border border-white/10 text-left overflow-auto max-h-32">
                  <code className="text-[10px] text-red-400 font-mono">
                    {this.state.error.toString()}
                  </code>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <button
                onClick={() => window.location.reload()}
                className="w-full sm:w-auto px-8 py-4 bg-primary text-white rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 hover:scale-105 transition-all shadow-lg shadow-primary/20"
              >
                <RefreshCcw className="size-5" />
                Recarregar App
              </button>
              <a
                href="/"
                onClick={() => this.setState({ hasError: false })}
                className="w-full sm:w-auto px-8 py-4 bg-white/5 text-white rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 hover:bg-white/10 transition-all border border-white/10"
              >
                <Home className="size-5" />
                Voltar ao Início
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
