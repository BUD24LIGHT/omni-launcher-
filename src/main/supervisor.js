const { spawn } = require("child_process");

/**
 * Supervisor: Manages process lifecycle with auto-recovery and backoff logic.
 */
class Supervisor {
  constructor(name, command, args, options = {}) {
    this.name = name;
    this.command = command;
    this.args = args;
    this.options = options;
    this.process = null;
    this.restartCount = 0;
    this.maxRestarts = options.maxRestarts || 10;
    this.backoffBase = options.backoffBase || 1000;
  }

  start(onData, onError) {
    if (this.process) this.process.kill();
    
    console.log(`[SUPERVISOR] Starting ${this.name}...`);
    this.process = spawn(this.command, this.args, this.options);

    this.process.stdout.on("data", (data) => {
      this.restartCount = 0; // Reset on successful data
      onData(data);
    });

    this.process.stderr.on("data", (data) => {
      console.warn(`[${this.name}_ERR]:`, data.toString());
    });

    this.process.on("exit", (code) => {
      console.error(`[SUPERVISOR] ${this.name} exited with code ${code}.`);
      this.recovery(onData, onError);
    });

    this.process.on("error", (err) => {
      console.error(`[SUPERVISOR] ${this.name} failed to start:`, err);
      onError(err);
    });
  }

  recovery(onData, onError) {
    if (this.restartCount >= this.maxRestarts) {
      console.error(`[SUPERVISOR] ${this.name} exceeded max restarts. Giving up.`);
      return;
    }

    const delay = Math.min(30000, this.backoffBase * Math.pow(2, this.restartCount));
    this.restartCount++;
    console.log(`[SUPERVISOR] Scheduling ${this.name} restart in ${delay}ms... (Attempt ${this.restartCount})`);
    
    setTimeout(() => this.start(onData, onError), delay);
  }

  stop() {
    if (this.process) {
      this.process.removeAllListeners();
      this.process.kill();
    }
  }
}

module.exports = Supervisor;
