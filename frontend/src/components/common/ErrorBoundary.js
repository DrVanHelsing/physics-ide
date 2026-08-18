import React from "react";

/**
 * ErrorBoundary
 *
 * Catches unhandled errors in any child component tree and renders a
 * graceful fallback instead of crashing the whole application.
 *
 * Usage:
 *   <ErrorBoundary fallback={<p>Something went wrong.</p>}>
 *     <SomeComponent />
 *   </ErrorBoundary>
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Log to console; swap for a real error-reporting service if needed.
    console.error("[ErrorBoundary] Uncaught error:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="error-boundary-fallback">
          <h2>Something went wrong.</h2>
          <details style={{ whiteSpace: "pre-wrap", fontSize: 12, opacity: 0.7 }}>
            {this.state.error?.toString()}
          </details>
          <button
            className="tb-btn"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
