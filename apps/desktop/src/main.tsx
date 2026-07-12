import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { createWebBridge } from "./api/webBridge";

if (!window.electronAPI) {
  window.electronAPI = createWebBridge();
  window.__KAISTU_IS_WEB__ = true;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
