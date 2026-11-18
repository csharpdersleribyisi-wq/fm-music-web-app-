import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message || 'An unexpected error occurred.' };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('Sonora ErrorBoundary caught:', error, info);
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, errorMessage: '' });
    window.location.reload();
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    let formattedDetail = this.state.errorMessage;
    try {
      const parsed = JSON.parse(this.state.errorMessage);
      if (parsed && parsed.error && parsed.operationType) {
        formattedDetail = `${parsed.operationType.toUpperCase()} on ${parsed.path || 'Firestore'}: ${parsed.error}`;
      }
    } catch {
      // keep raw message
    }

    return (
      <div className="min-h-screen bg-[#0B0D12] text-[#F4F4F6] flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-[#131720] border border-white/10 rounded-xl p-8">
          <div className="flex items-center gap-3 text-[#E5A93C] mb-4">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <h2 className="text-lg font-semibold font-display">Session Interrupted</h2>
          </div>
          <p className="text-sm text-[#8E95A5] leading-relaxed mb-4">
            Sonora encountered a synchronization or permission error while communicating with Firestore.
          </p>
          <div className="bg-[#0B0D12] border border-white/10 rounded-lg p-3 mb-6 font-mono-tabular text-xs text-[#F4F4F6]/80 break-all">
            {formattedDetail}
          </div>
          <button
            onClick={this.handleReset}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#E5A93C] text-[#0B0D12] text-sm font-semibold rounded-lg hover:bg-[#ebb758] transition-colors whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-4 h-4" />
            Reload Studio
          </button>
        </div>
      </div>
    );
  }
}
