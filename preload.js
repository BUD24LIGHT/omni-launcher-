const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("omniAPI", {
  getHome: () => ipcRenderer.invoke("fs:home"),
  listDirectory: (targetPath) => ipcRenderer.invoke("fs:list", targetPath),
  openPath: (targetPath) => ipcRenderer.invoke("fs:open", targetPath),
  renamePath: (sourcePath, nextName) => ipcRenderer.invoke("fs:rename", sourcePath, nextName),
  createFolder: (basePath, name) => ipcRenderer.invoke("fs:create-folder", basePath, name),
  movePath: (sourcePath, targetDirectory) => ipcRenderer.invoke("fs:move", sourcePath, targetDirectory),
  revealInFolder: (targetPath) => ipcRenderer.invoke("fs:reveal", targetPath),

  getSettings: () => ipcRenderer.invoke("settings:get"),
  setSetting: (key, val) => ipcRenderer.invoke("settings:set", { key, val }),
  validatePath: (toolPath, args) =>
    ipcRenderer.invoke("settings:validate", { path: toolPath, args }),

  listAutomationScripts: () => ipcRenderer.invoke("automation:list-scripts"),
  runAutomation: (cfg) => ipcRenderer.invoke("automation:run", cfg),
  cancelAutomation: (id) => ipcRenderer.invoke("automation:cancel", id),

  pickScript: () => ipcRenderer.invoke("dialog:pick-script"),

  minimize: () => ipcRenderer.invoke("app:minimize"),
  maximize: () => ipcRenderer.invoke("app:maximize"),
  quit: () => ipcRenderer.invoke("app:quit"),
  copyText: (text) => ipcRenderer.invoke("app:copy-text", text),

  onSystemPulse: (cb) => ipcRenderer.on("sys:pulse", (_event, data) => cb(data)),
  onAdbUpdate: (cb) => ipcRenderer.on("sys:adb-update", (_event, data) => cb(data)),
  onAdbError: (cb) => ipcRenderer.on("sys:adb-error", (_event, message) => cb(message)),
  onFsChanged: (cb) => ipcRenderer.on("fs:changed", (_event, data) => cb(data)),
  onAutomationTask: (event, cb) =>
    ipcRenderer.on(`automation:${event}`, (_event, data) => cb(data)),
});
