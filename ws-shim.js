// Shim for the `ws` package in React Native.
// React Native provides a native WebSocket global, so the Node.js `ws`
// package is never needed. Exporting a no-op prevents Metro from bundling
// the Node-only `ws` module (which references `net`, `tls`, etc.).
module.exports = {};
