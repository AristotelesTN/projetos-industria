const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("dosecerta", {
  platform: process.platform,
  apiBaseUrl: process.env.DOSECERTA_API_URL || "http://127.0.0.1:8000/api",
});
