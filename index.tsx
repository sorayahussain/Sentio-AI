import React, { Component, ErrorInfo, ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// --- Start of ErrorBoundary Component ---
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  // FIX: Removed `public` modifier. It's the default and may confuse some tools.
  state: ErrorBoundaryState = {
    hasError: false
  };

  // FIX: Removed `public` modifier.
  static getDerivedStateFromError(_: Error): ErrorBoundaryState {
    return { hasError: true };
  }

  // FIX: Removed `public` modifier.
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  // FIX: Removed `public` modifier.
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white p-4">
            <div className="max-w-xl w-full bg-gray-800 rounded-2xl shadow-2xl p-8 text-center border border-red-500">
                <h1 className="text-3xl font-bold text-red-400 mb-4">Something went wrong.</h1>
                <p className="text-gray-300 mb-6">We've encountered an unexpected error. This can sometimes happen if an external script or service fails to load. Please try reloading the page.</p>
                <button 
                    onClick={() => window.location.reload()}
                    className="px-6 py-3 font-bold rounded-lg shadow-lg bg-red-600 text-white hover:bg-red-700 transition-transform duration-200 hover:scale-105"
                >
                    Reload Page
                </button>
            </div>
        </div>
      );
    }

    return this.props.children;
  }
}
// --- End of ErrorBoundary Component ---


const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
        <App />
    </ErrorBoundary>
  </React.StrictMode>
);