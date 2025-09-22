import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message?: string;
}

export class ErrorBoundary extends React.Component<{ label: string }, ErrorBoundaryState> {
  constructor(props: { label: string }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error) {
    console.error(`[${this.props.label}] module error`, error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="module-card text-red-300 border-red-600">
          <h3 className="font-semibold">{this.props.label} unavailable</h3>
          <p className="text-sm">{this.state.message}</p>
        </div>
      );
    }

    return this.props.children;
  }
}
