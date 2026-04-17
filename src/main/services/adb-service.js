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
    });

    this.readyFallback = setTimeout(() => {
      this.emit("sys:adb-update", {
        count: 0,
        status: "Ready",
      });
    }, 1500);

    this.supervisor.start(
      (data) => {
        if (this.readyFallback) {
          clearTimeout(this.readyFallback);
          this.readyFallback = null;
        }
        const output = data.toString().trim();
        const devices = output.split("\n").filter(l => l.includes("\tdevice")).length;
        this.emit("sys:adb-update", {
          count: devices,
          status: devices > 0 ? `${devices} connected` : "Ready"
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
