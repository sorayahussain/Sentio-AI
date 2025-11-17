// FIX: Changed to a default import for React to resolve a potential module resolution issue with named imports.
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// --- Start of ErrorBoundary Component ---
interface ErrorBoundaryProps {
  // FIX: Changed to `React.ReactNode` to align with the updated React import style.
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

// FIX: Changed `Component` to `React.Component` to align with the import change and fix the type error.
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  // FIX: Re-introduced constructor to ensure `this.props` is correctly typed and available in standard TypeScript environments,
  // fulfilling the contract of React.Component.
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  // FIX: Removed `public` modifier.
  static getDerivedStateFromError(_: Error): ErrorBoundaryState {
    return { hasError: true };
  }

  // FIX: Removed `public` modifier.
  // FIX: Changed to `React.ErrorInfo` to align with the updated React import style.
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
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