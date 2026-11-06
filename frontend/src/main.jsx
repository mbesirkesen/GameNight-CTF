import { Component, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            background: "#020617",
            color: "#e2e8f0",
            fontFamily: "ui-monospace, monospace",
            padding: 24,
            textAlign: "center",
          }}
        >
          <div>
            <p style={{ color: "#f87171", marginBottom: 8 }}>Bir hata oluştu</p>
            <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 16 }}>
              {String(this.state.error?.message || this.state.error)}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                border: "1px solid #334155",
                background: "#0f172a",
                color: "#e2e8f0",
                padding: "8px 14px",
                cursor: "pointer",
              }}
            >
              Sayfayı yenile
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
