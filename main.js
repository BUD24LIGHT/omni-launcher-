const {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  net,
  protocol,
  screen,
  shell,
} = require("electron");
const os = require("os");
const path = require("path");
const { pathToFileURL } = require("url");

const AdbService = require("./src/main/services/adb-service");
const AutomationService = require("./src/main/services/automation-service");
const FsService = require("./src/main/services/fs-service");
const SettingsService = require("./src/main/services/settings-service");

let mainWindow = null;
let adbService = null;
let fsService = null;
let settingsService = null;
let automationService = null;
let telemetryInterval = null;

function sendLog(channel, payload) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send(channel, payload);
}

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: Math.min(1440, width - 80),
    height: Math.min(960, height - 80),
    minWidth: 1120,
    minHeight: 760,
    center: true,
    backgroundColor: "#081317",
    frame: false,
    show: false,
    title: "Omni Launcher",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  });

  settingsService = new SettingsService();
  adbService = new AdbService(mainWindow.webContents);
  fsService = new FsService(mainWindow.webContents);
  automationService = new AutomationService(mainWindow.webContents, settingsService);

  adbService.start();

  mainWindow.loadFile(path.join(__dirname, "src", "index.html"));

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.on("closed", () => {
    if (telemetryInterval) {
      clearInterval(telemetryInterval);
      telemetryInterval = null;
    }

    adbService?.stop();
    fsService?.cleanupWatcher();
    automationService?.stop();

    adbService = null;
    fsService = null;
    settingsService = null;
    automationService = null;
    mainWindow = null;
  });
}

function startTelemetry() {
  telemetryInterval = setInterval(() => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      if (telemetryInterval) {
        clearInterval(telemetryInterval);
        telemetryInterval = null;
      }
      return;
    }

    const load = os.loadavg();
    const cpu = `${(load[0] * 10).toFixed(1)}%`;
    const mem = `${((1 - os.freemem() / os.totalmem()) * 100).toFixed(1)}%`;
    const uptimeSec = Math.floor(os.uptime());
    const uptime = `${Math.floor(uptimeSec / 3600)}h ${Math.floor((uptimeSec % 3600) / 60)}m`;

    sendLog("sys:pulse", { cpu, mem, uptime, host: os.hostname() });
  }, 2000);
}

async function pickFile(filters) {
  if (!mainWindow) {
    return null;
  }

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile"],
    filters,
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
}

app.whenReady().then(() => {
  protocol.handle("omni-file", async (request) => {
    const fileName = path.basename(new URL(request.url).pathname);
    if (!fileName.endsWith(".png")) {
      return new Response("Forbidden", { status: 403 });
    }

    const fullPath = path.join(os.homedir(), fileName);
    return net.fetch(pathToFileURL(fullPath).toString());
  });

  ipcMain.handle("fs:home", () => os.homedir());
  ipcMain.handle("fs:list", (_, target) => fsService.list(target));
  ipcMain.handle("fs:open", (_, targetPath) => shell.openPath(targetPath));
  ipcMain.handle("fs:rename", (_, sourcePath, nextName) => fsService.rename(sourcePath, nextName));
  ipcMain.handle("fs:create-folder", (_, basePath, name) => fsService.createFolder(basePath, name));
  ipcMain.handle("fs:move", (_, sourcePath, targetDirectory) => fsService.move(sourcePath, targetDirectory));
  ipcMain.handle("fs:reveal", (_, targetPath) => {
    shell.showItemInFolder(targetPath);
    return true;
  });

  ipcMain.handle("settings:get", () => settingsService.data);
  ipcMain.handle("settings:set", (_, { key, val }) => {
    settingsService.set(key, val);
    return settingsService.data;
  });
  ipcMain.handle("settings:validate", (_, { path: toolPath, args }) =>
    settingsService.validatePath(toolPath, args),
  );

  ipcMain.handle("automation:run", (_, cfg) => automationService.run(cfg));
  ipcMain.handle("automation:cancel", (_, id) => automationService.cancel(id));
  ipcMain.handle("automation:list-scripts", () => automationService.listScripts());

  ipcMain.handle("dialog:pick-script", () =>
    pickFile([
      { name: "Scripts", extensions: ["sh", "adb", "bash"] },
      { name: "All Files", extensions: ["*"] },
    ]),
  );

  ipcMain.handle("app:quit", () => app.quit());
  ipcMain.handle("app:minimize", () => mainWindow?.minimize());
  ipcMain.handle("app:copy-text", (_event, text) => {
    require("electron").clipboard.writeText(String(text ?? ""));
    return true;
  });
  ipcMain.handle("app:maximize", () => {
    if (!mainWindow) {
      return false;
    }

    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
      return false;
    }

    mainWindow.maximize();
    return true;
  });

  createWindow();
  startTelemetry();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
