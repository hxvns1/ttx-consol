import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: '',
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let readable = error.message || 'Terjadi kesalahan tidak terduga pada aplikasi.';
    try {
      const parsed = JSON.parse(error.message) as { error?: string; operationType?: string };
      if (parsed && parsed.error) {
        readable = `Kesalahan sinkronisasi (${parsed.operationType ?? 'firestore'}): ${parsed.error}`;
      }
    } catch {
      // Keep original message
    }
    return {
      hasError: true,
      errorMessage: readable,
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Application ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F6F8FA] flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white border border-slate-200 rounded-lg p-6 space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-[#DC2626] shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h1 className="text-base font-semibold text-[#0E2439]">
                  Terjadi Gangguan Aplikasi
                </h1>
                <p className="text-xs text-slate-600 leading-relaxed break-words">
                  {this.state.errorMessage}
                </p>
              </div>
            </div>
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#0E2439] rounded-md hover:bg-[#193A58] transition-colors whitespace-nowrap"
              >
                <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                <span>Muat Ulang Aplikasi</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
