const { app } = require("electron");
const fs = require("fs");
const path = require("path");
const { EventEmitter } = require("events");

/**
 * SETTINGS SERVICE v1.0
 * Persistent configuration manager with hot-reload support.
 */
class SettingsService extends EventEmitter {
  constructor() {
    super();
    this.configDir = app.getPath("userData");
    this.configFile = path.join(this.configDir, "config.json");
    this.defaults = {
      adbPath: "adb",
      jadxPath: "jadx",
      apktoolPath: "apktool",
      favoriteScripts: [],
      recentRuns: []
    };
    this.data = { ...this.defaults };
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.configFile)) {
        const raw = fs.readFileSync(this.configFile, "utf8");
        this.data = { ...this.defaults, ...JSON.parse(raw) };
      }
    } catch (err) {
      console.error("[SETTINGS] Load failed, using defaults.", err);
    }
  }

  save() {
    try {
      fs.writeFileSync(this.configFile, JSON.stringify(this.data, null, 2));
    } catch (err) {
      console.error("[SETTINGS] Save failed.", err);
    }
  }

  get(key) {
    return this.data[key];
  }

  set(key, value) {
    this.data[key] = value;
    this.save();
    this.emit("updated", this.data);
  }

  async validatePath(toolPath, args = ["--version"]) {
    const { spawn } = require("child_process");
    return new Promise((resolve) => {
      const proc = spawn(toolPath, args);
      proc.on("error", () => resolve({ valid: false, message: "FILE_NOT_FOUND" }));
      proc.on("close", (code) => {
        resolve({ valid: code === 0 || code === 1, code });
      });
    });
  }
}

module.exports = SettingsService;
