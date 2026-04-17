const { spawn } = require("child_process");
const fs = require("fs/promises");
const path = require("path");

class AutomationService {
  constructor(eventEmitter, settings) {
    this.emitter = eventEmitter;
    this.settings = settings;
    this.queue = [];
    this.activeTask = null;
    this.isProcessing = false;

    // Hot-reload support
    this.settings.on("updated", () => {
      this._emit("automation:log", { data: "REFRESHING_TOOLCHAIN_CONFIG...", type: "sys" });
    });
  }

  async run({ scriptPath, deviceId }) {
    const id = `task_${Date.now()}`;
    this.queue.push({ id, scriptPath, deviceId });
    this._processQueue();
    return id;
  }

  async _processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;

    while (this.queue.length > 0) {
      this.activeTask = this.queue.shift();
      this._emit("automation:start", this.activeTask);

      try {
        await this._spawnTask(this.activeTask);
        this._emit("automation:done", { id: this.activeTask.id });
      } catch (e) {
        this._emit("automation:error", { id: this.activeTask.id, error: e.message });
      }
    }

    this.activeTask = null;
    this.isProcessing = false;
  }

  _spawnTask(task) {
    return new Promise((resolve, reject) => {
      const adb = this.settings.get("adbPath");
      // Use configured ADB path instead of global 'bash' where possible or inject into env
      const proc = spawn("bash", [task.scriptPath], {
        env: { 
          ...process.env, 
          TARGET_DEVICE: task.deviceId,
          ADB: adb // Inject path for script usage
        }
      });

      let stdout = "";
      proc.stdout.on("data", (d) => {
        stdout += d.toString();
        this._emit("automation:log", { id: task.id, data: d.toString() });
      });

      proc.on("close", (code) => {
        if (code === 0) resolve({ stdout });
        else reject(new Error(`EXIT_CODE_${code}`));
      });

      proc.on("error", (err) => reject(err));
      
      this.activeTask.process = proc;
    });
  }

  cancel(id) {
    if (this.activeTask && this.activeTask.id === id) {
      this.activeTask.process?.kill();
      return true;
    }
    this.queue = this.queue.filter(t => t.id !== id);
    return true;
  }

  async listScripts() {
    const dir = path.join(require("os").homedir(), "Automation");
    try {
      const files = await fs.readdir(dir);
      return files
        .filter(f => f.endsWith(".sh") || f.endsWith(".adb"))
        .map((name) => ({
          name,
          path: path.join(dir, name),
        }));
    } catch { return []; }
  }

  stop() {
    if (this.activeTask?.process) this.activeTask.process.kill();
    this.queue = [];
  }

  _emit(event, data) {
    if (!this.emitter.isDestroyed()) {
      this.emitter.send(event, data);
    }
  }
}

module.exports = AutomationService;
