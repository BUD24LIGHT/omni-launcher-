const Supervisor = require("../supervisor");

class AdbService {
  constructor(eventEmitter) {
    this.emitter = eventEmitter;
    this.supervisor = new Supervisor("adb-tracker", "adb", ["track-devices"]);
    this.readyFallback = null;
  }

  emit(channel, payload) {
    if (!this.emitter.isDestroyed()) {
      this.emitter.send(channel, payload);
    }
  }

  start() {
    this.emit("sys:adb-update", {
      count: 0,
      status: "Starting ADB...",
      devices: [],
    });

    this.readyFallback = setTimeout(() => {
      this.emit("sys:adb-update", {
        count: 0,
        status: "Ready",
        devices: [],
      });
    }, 1500);

    this.supervisor.start(
      (data) => {
        if (this.readyFallback) {
          clearTimeout(this.readyFallback);
          this.readyFallback = null;
        }
        const output = data.toString().trim();
        const deviceLines = output
          .split("\n")
          .filter((line) => line.includes("\tdevice"))
          .map((line) => line.split("\t")[0].trim())
          .filter(Boolean);
        this.emit("sys:adb-update", {
          count: deviceLines.length,
          status: deviceLines.length > 0 ? `${deviceLines.length} connected` : "Ready",
          devices: deviceLines,
        });
      },
      (err) => {
        if (this.readyFallback) {
          clearTimeout(this.readyFallback);
          this.readyFallback = null;
        }
        this.emit("sys:adb-error", err.message);
      }
    );
  }

  stop() {
    if (this.readyFallback) {
      clearTimeout(this.readyFallback);
      this.readyFallback = null;
    }
    this.supervisor.stop();
  }
}

module.exports = AdbService;
