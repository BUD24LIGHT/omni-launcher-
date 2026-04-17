const fs = require("fs/promises");
const { watch } = require("fs");
const path = require("path");
const os = require("os");

class FsService {
  constructor(eventEmitter) {
    this.emitter = eventEmitter;
    this.activeWatcher = null;
    this.currentPath = null;
  }

  async list(targetPath) {
    const resolved = path.resolve(targetPath || os.homedir());
    
    // Stop previous watcher safely
    this.cleanupWatcher();

    try {
      const stats = await fs.stat(resolved);
      if (!stats.isDirectory()) throw new Error("NOT_A_DIRECTORY");

      const files = await fs.readdir(resolved, { withFileTypes: true });
      const entries = await Promise.all(files.map(async f => {
        const p = path.join(resolved, f.name);
        try {
          const s = await fs.stat(p);
          return { name: f.name, path: p, isDirectory: f.isDirectory(), size: s.size };
        } catch { return null; }
      }));

      this.currentPath = resolved;
      this.attachWatcher(resolved);

      return { 
        success: true,
        current: resolved, 
        entries: entries.filter(Boolean),
        mounts: await this.getMounts()
      };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  async rename(targetPath, nextName) {
    try {
      const resolved = path.resolve(targetPath);
      const destination = path.join(path.dirname(resolved), nextName);
      await fs.rename(resolved, destination);
      return { success: true, path: destination };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async createFolder(basePath, name) {
    try {
      const resolvedBase = path.resolve(basePath || os.homedir());
      const target = path.join(resolvedBase, name);
      await fs.mkdir(target, { recursive: false });
      return { success: true, path: target };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async move(sourcePath, targetDirectory) {
    try {
      const source = path.resolve(sourcePath);
      const destinationDir = path.resolve(targetDirectory);
      const destination = path.join(destinationDir, path.basename(source));
      await fs.rename(source, destination);
      return { success: true, path: destination };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  attachWatcher(dir) {
    try {
      this.activeWatcher = watch(dir, (event, filename) => {
        if (!this.emitter.isDestroyed()) {
          this.emitter.send("fs:changed", { event, filename, path: dir });
        }
      });
      
      this.activeWatcher.on("error", (err) => {
        console.warn(`[FS_WATCH_ERR] ${dir}:`, err);
        this.cleanupWatcher();
      });
    } catch (err) {
      console.warn(`[FS_WATCH_FAIL] ${dir}:`, err.message);
    }
  }

  cleanupWatcher() {
    if (this.activeWatcher) {
      this.activeWatcher.removeAllListeners();
      try { this.activeWatcher.close(); } catch {}
      this.activeWatcher = null;
    }
  }

  async getMounts() {
    try {
      const data = await fs.readFile("/proc/mounts", "utf8");
      return data.split("\n")
        .filter(l => l.startsWith("/dev/") && !l.includes("loop"))
        .map(l => {
          const p = l.split(" ");
          return { mountPath: p[1], label: path.basename(p[1]) || "Root" };
        });
    } catch {
      return [{ mountPath: "/", label: "Root" }];
    }
  }
}

module.exports = FsService;
