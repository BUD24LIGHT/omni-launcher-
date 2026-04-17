const state = {
  view: "dashboard",
  explorer: {
    path: "",
    entries: [],
    mounts: [],
    query: "",
    contextPath: null,
    contextIsDirectory: false,
  },
  automation: {
    activeTaskId: null,
    scripts: [],
    favorites: [],
    recentRuns: [],
  },
  settings: null,
  system: {
    adb: "Starting ADB...",
    cpu: "0.0%",
    mem: "0.0%",
    uptime: "0h 0m",
    host: "",
  },
  modal: {
    isOpen: false,
    onSubmit: null,
  },
};

const settingDefinitions = [
  { key: "adbPath", label: "ADB executable", args: ["version"] },
  { key: "jadxPath", label: "jadx executable", args: ["--version"] },
  { key: "apktoolPath", label: "apktool executable", args: ["--version"] },
];

const logger = {
  el: null,
  init() {
    this.el = document.getElementById("term-body");
  },
  log(message, type = "data") {
    if (!this.el) {
      return;
    }

    const entry = document.createElement("div");
    entry.className = "log-entry";
    entry.innerHTML = `
      <span class="log-time">[${new Date().toLocaleTimeString("en-GB")}]</span>
      <span class="log-msg ${type}">${escapeHtml(String(message))}</span>
    `;
    this.el.appendChild(entry);
    this.el.scrollTop = this.el.scrollHeight;

    if (this.el.children.length > 400) {
      this.el.children[0].remove();
    }
  },
  clear() {
    if (this.el) {
      this.el.innerHTML = "";
    }
  },
};

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function showToast(message, tone = "info") {
  const container = document.getElementById("toast-container");
  if (!container) {
    return;
  }

  const toast = document.createElement("div");
  toast.className = `toast ${tone}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 2800);
}

function setTerminalBadge(text, tone = "idle") {
  const badge = document.getElementById("term-badge");
  if (!badge) {
    return;
  }
  badge.textContent = text;
  badge.dataset.tone = tone;
}

function openFileOpModal({
  kicker,
  title,
  copy,
  label,
  value = "",
  submitText = "Save",
  onSubmit,
}) {
  const modal = document.getElementById("file-op-modal");
  const kickerEl = document.getElementById("file-op-kicker");
  const titleEl = document.getElementById("file-op-title");
  const copyEl = document.getElementById("file-op-copy");
  const labelEl = document.getElementById("file-op-label");
  const inputEl = document.getElementById("file-op-input");
  const submitEl = document.getElementById("btn-file-op-submit");

  if (!modal || !kickerEl || !titleEl || !copyEl || !labelEl || !inputEl || !submitEl) {
    return;
  }

  kickerEl.textContent = kicker;
  titleEl.textContent = title;
  copyEl.textContent = copy;
  labelEl.textContent = label;
  inputEl.value = value;
  submitEl.textContent = submitText;
  state.modal.isOpen = true;
  state.modal.onSubmit = onSubmit;
  modal.classList.remove("hidden");

  queueMicrotask(() => {
    inputEl.focus();
    inputEl.select();
  });
}

function closeFileOpModal() {
  const modal = document.getElementById("file-op-modal");
  if (!modal) {
    return;
  }

  modal.classList.add("hidden");
  state.modal.isOpen = false;
  state.modal.onSubmit = null;
}

async function submitFileOpModal() {
  const inputEl = document.getElementById("file-op-input");
  if (!inputEl || typeof state.modal.onSubmit !== "function") {
    return;
  }

  const value = inputEl.value.trim();
  await state.modal.onSubmit(value);
}

function switchView(id) {
  state.view = id;

  document.querySelectorAll(".view-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `view-${id}`);
  });

  document.querySelectorAll(".nav-item").forEach((button) => {
    button.classList.toggle("active", button.id === `nav-${id}`);
  });

  logger.log(`Switched to ${id}`, "sys");

  if (id === "explorer") {
    void loadDirectory(state.explorer.path || null);
  }
  if (id === "automation") {
    void refreshAutomationScripts();
    renderFavoritesAndRecents();
  }
  if (id === "settings") {
    void loadSettings();
  }
}

function renderDashboardAutomationPanels() {
  const favoritesEl = document.getElementById("dashboard-favorites");
  const recentsEl = document.getElementById("dashboard-recents");
  if (!favoritesEl || !recentsEl) {
    return;
  }

  if (state.automation.favorites.length === 0) {
    favoritesEl.innerHTML = `<div class="empty-state">Pin scripts from the automation view.</div>`;
  } else {
    favoritesEl.innerHTML = state.automation.favorites
      .slice(0, 4)
      .map(
        (item) => `
          <div class="activity-row action-row compact-row">
            <div>
              <strong>${escapeHtml(item.name || basename(item.path))}</strong>
              <span>${escapeHtml(item.path)}</span>
            </div>
            <div class="item-actions">
              <button class="tiny-btn" data-dashboard-favorite="${escapeHtml(item.path)}">Use</button>
            </div>
          </div>
        `,
      )
      .join("");
  }

  if (state.automation.recentRuns.length === 0) {
    recentsEl.innerHTML = `<div class="empty-state">Recent launches will show here.</div>`;
  } else {
    recentsEl.innerHTML = state.automation.recentRuns
      .slice(0, 4)
      .map(
        (item) => `
          <div class="activity-row action-row compact-row">
            <div>
              <strong>${escapeHtml(basename(item.scriptPath))}</strong>
              <span>${escapeHtml(item.at)}</span>
            </div>
            <div class="item-actions">
              <button class="tiny-btn" data-dashboard-recent-use="${escapeHtml(item.scriptPath)}" data-device="${escapeHtml(
                item.deviceId || "",
              )}">Use</button>
              <button class="tiny-btn" data-dashboard-recent-run="${escapeHtml(item.scriptPath)}" data-device="${escapeHtml(
                item.deviceId || "",
              )}">Run</button>
            </div>
          </div>
        `,
      )
      .join("");
  }

  favoritesEl.querySelectorAll("[data-dashboard-favorite]").forEach((button) => {
    button.addEventListener("click", () => {
      populateAutomationForm(button.dataset.dashboardFavorite, "");
      switchView("automation");
    });
  });
  recentsEl.querySelectorAll("[data-dashboard-recent-use]").forEach((button) => {
    button.addEventListener("click", () => {
      populateAutomationForm(button.dataset.dashboardRecentUse, button.dataset.device || "");
      switchView("automation");
    });
  });
  recentsEl.querySelectorAll("[data-dashboard-recent-run]").forEach((button) => {
    button.addEventListener("click", () =>
      void runAutomation(button.dataset.dashboardRecentRun, button.dataset.device || ""),
    );
  });
}

function hideExplorerContextMenu() {
  const menu = document.getElementById("explorer-context-menu");
  if (!menu) {
    return;
  }
  menu.classList.add("hidden");
  menu.innerHTML = "";
  state.explorer.contextPath = null;
}

function showExplorerContextMenu(targetPath, isDirectory, x, y) {
  const menu = document.getElementById("explorer-context-menu");
  if (!menu) {
    return;
  }

  state.explorer.contextPath = targetPath;
  state.explorer.contextIsDirectory = isDirectory;
  menu.innerHTML = `
    <button class="context-item" data-action="open">Open</button>
    <button class="context-item" data-action="reveal">Reveal in folder</button>
    <button class="context-item" data-action="copy">Copy path</button>
    <button class="context-item" data-action="rename">Rename</button>
    <button class="context-item" data-action="move">Move...</button>
    ${isDirectory ? '<button class="context-item" data-action="new-folder">New folder here</button>' : ""}
    ${isDirectory ? '<button class="context-item" data-action="enter">Open folder here</button>' : ""}
  `;
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  menu.classList.remove("hidden");

  menu.querySelectorAll(".context-item").forEach((button) => {
    button.addEventListener("click", async () => {
      const action = button.dataset.action;
      if (action === "open") {
        await window.omniAPI.openPath(targetPath);
      } else if (action === "reveal") {
        await window.omniAPI.revealInFolder(targetPath);
      } else if (action === "copy") {
        await window.omniAPI.copyText(targetPath);
        showToast("Copied path", "success");
      } else if (action === "rename") {
        const currentName = basename(targetPath);
        openFileOpModal({
          kicker: "File operation",
          title: "Rename item",
          copy: targetPath,
          label: "New name",
          value: currentName,
          submitText: "Rename",
          onSubmit: async (nextName) => {
            if (!nextName || nextName === currentName) {
              closeFileOpModal();
              return;
            }
            const result = await window.omniAPI.renamePath(targetPath, nextName);
            if (result.success) {
              closeFileOpModal();
              showToast("Renamed", "success");
              await loadDirectory(state.explorer.path);
            } else {
              showToast(`Rename failed: ${result.error}`, "error");
            }
          },
        });
      } else if (action === "move") {
        openFileOpModal({
          kicker: "File operation",
          title: "Move item",
          copy: targetPath,
          label: "Destination directory",
          value: state.explorer.path || "/",
          submitText: "Move",
          onSubmit: async (targetDirectory) => {
            if (!targetDirectory) {
              return;
            }
            const result = await window.omniAPI.movePath(targetPath, targetDirectory);
            if (result.success) {
              closeFileOpModal();
              showToast("Moved", "success");
              await loadDirectory(state.explorer.path);
            } else {
              showToast(`Move failed: ${result.error}`, "error");
            }
          },
        });
      } else if (action === "new-folder" && isDirectory) {
        openFileOpModal({
          kicker: "File operation",
          title: "Create folder",
          copy: `Inside ${targetPath}`,
          label: "Folder name",
          value: "New Folder",
          submitText: "Create",
          onSubmit: async (name) => {
            if (!name) {
              return;
            }
            const result = await window.omniAPI.createFolder(targetPath, name);
            if (result.success) {
              closeFileOpModal();
              showToast("Folder created", "success");
              await loadDirectory(targetPath);
            } else {
              showToast(`Create folder failed: ${result.error}`, "error");
            }
          },
        });
      } else if (action === "enter" && isDirectory) {
        await loadDirectory(targetPath);
      }
      hideExplorerContextMenu();
    });
  });
}

async function loadDirectory(target = null) {
  const requested = target || (await window.omniAPI.getHome());
  const response = await window.omniAPI.listDirectory(requested);

  if (!response.success) {
    showToast(`Unable to open ${requested}`, "error");
    logger.log(`Filesystem error: ${response.error}`, "error");
    return;
  }

  state.explorer.path = response.current;
  state.explorer.entries = response.entries || [];
  state.explorer.mounts = response.mounts || [];
  renderExplorer();
}

async function createFolderInCurrentDirectory() {
  openFileOpModal({
    kicker: "File operation",
    title: "Create folder",
    copy: `Inside ${state.explorer.path || "/"}`,
    label: "Folder name",
    value: "New Folder",
    submitText: "Create",
    onSubmit: async (name) => {
      if (!name) {
        return;
      }
      const result = await window.omniAPI.createFolder(state.explorer.path || "/", name);
      if (result.success) {
        closeFileOpModal();
        showToast("Folder created", "success");
        await loadDirectory(state.explorer.path);
      } else {
        showToast(`Create folder failed: ${result.error}`, "error");
      }
    },
  });
}

function getFilteredEntries() {
  const query = state.explorer.query.trim().toLowerCase();
  const sorted = [...state.explorer.entries].sort(
    (a, b) => Number(b.isDirectory) - Number(a.isDirectory) || a.name.localeCompare(b.name),
  );

  if (!query) {
    return sorted;
  }

  return sorted.filter((entry) => entry.name.toLowerCase().includes(query));
}

function renderBreadcrumbs() {
  const breadcrumbs = document.getElementById("explorer-breadcrumbs");
  if (!breadcrumbs) {
    return;
  }

  const current = state.explorer.path || "/";
  const parts = current.split("/").filter(Boolean);
  const segments = [{ label: "Root", path: "/" }];
  let running = "";

  for (const part of parts) {
    running = pathJoin(running || "/", part);
    segments.push({ label: part, path: running });
  }

  breadcrumbs.innerHTML = segments
    .map(
      (segment) => `
        <button class="crumb-btn" data-path="${escapeHtml(segment.path)}">${escapeHtml(segment.label)}</button>
      `,
    )
    .join('<span class="crumb-sep">/</span>');

  breadcrumbs.querySelectorAll(".crumb-btn").forEach((button) => {
    button.addEventListener("click", () => {
      void loadDirectory(button.dataset.path);
    });
  });
}

function renderExplorer() {
  const content = document.getElementById("explorer-content");
  const pathLabel = document.getElementById("explorer-path");
  const mountList = document.getElementById("mount-list");
  const meta = document.getElementById("explorer-meta");

  if (!content || !pathLabel || !mountList || !meta) {
    return;
  }

  renderBreadcrumbs();
  pathLabel.textContent = state.explorer.path;
  const filteredEntries = getFilteredEntries();
  meta.textContent = `${filteredEntries.length} of ${state.explorer.entries.length} items`;

  mountList.innerHTML = state.explorer.mounts
    .map(
      (mount) => `
        <button class="mount-item" data-path="${escapeHtml(mount.mountPath)}">
          <strong>${escapeHtml(mount.label)}</strong>
          <span>${escapeHtml(mount.mountPath)}</span>
        </button>
      `,
    )
    .join("");

  if (filteredEntries.length === 0) {
    content.innerHTML = `<div class="empty-state">${
      state.explorer.query ? "No files match this filter." : "This folder is empty."
    }</div>`;
  } else {
    content.innerHTML = filteredEntries
      .map(
        (entry) => `
          <div class="explorer-item" data-path="${escapeHtml(entry.path)}" data-dir="${entry.isDirectory}">
            <div>
              <div class="item-title">${escapeHtml(entry.name)}</div>
              <div class="item-meta">${entry.isDirectory ? "Folder" : formatBytes(entry.size)}</div>
            </div>
            <div class="item-actions">
              <button class="tiny-btn" data-action="open" data-path="${escapeHtml(entry.path)}">Open</button>
              <button class="tiny-btn" data-action="reveal" data-path="${escapeHtml(entry.path)}">Reveal</button>
              <button class="tiny-btn" data-action="copy" data-path="${escapeHtml(entry.path)}">Copy</button>
            </div>
          </div>
        `,
      )
      .join("");
  }

  content.querySelectorAll(".explorer-item").forEach((item) => {
    item.addEventListener("dblclick", async () => {
      const targetPath = item.dataset.path;
      const isDir = item.dataset.dir === "true";
      if (isDir) {
        await loadDirectory(targetPath);
        return;
      }
      await window.omniAPI.openPath(targetPath);
    });

    item.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      showExplorerContextMenu(
        item.dataset.path,
        item.dataset.dir === "true",
        event.clientX,
        event.clientY,
      );
    });
  });

  content.querySelectorAll(".tiny-btn").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.stopPropagation();
      const action = button.dataset.action;
      const targetPath = button.dataset.path;
      if (action === "open") {
        await window.omniAPI.openPath(targetPath);
      } else if (action === "reveal") {
        await window.omniAPI.revealInFolder(targetPath);
      } else if (action === "copy") {
        await window.omniAPI.copyText(targetPath);
        showToast("Copied path", "success");
      }
    });
  });

  mountList.querySelectorAll(".mount-item").forEach((button) => {
    button.addEventListener("click", async () => {
      await loadDirectory(button.dataset.path);
    });
  });
}

function normalizeRecentRuns(recentRuns) {
  return [...recentRuns]
    .filter((item) => item && item.scriptPath)
    .slice(0, 12);
}

async function saveAutomationState() {
  await window.omniAPI.setSetting("favoriteScripts", state.automation.favorites);
  await window.omniAPI.setSetting("recentRuns", normalizeRecentRuns(state.automation.recentRuns));
}

function isFavorite(scriptPath) {
  return state.automation.favorites.some((item) => item.path === scriptPath);
}

function renderFavoritesAndRecents() {
  const favoritesEl = document.getElementById("automation-favorites");
  const recentsEl = document.getElementById("automation-recents");
  if (!favoritesEl || !recentsEl) {
    return;
  }

  if (state.automation.favorites.length === 0) {
    favoritesEl.innerHTML = `<div class="empty-state">No favorites yet.</div>`;
  } else {
    favoritesEl.innerHTML = state.automation.favorites
      .map(
        (item) => `
          <div class="activity-row action-row">
            <div>
              <strong>${escapeHtml(item.name || basename(item.path))}</strong>
              <span>${escapeHtml(item.path)}</span>
            </div>
            <div class="item-actions">
              <button class="tiny-btn" data-favorite-use="${escapeHtml(item.path)}">Use</button>
              <button class="tiny-btn" data-favorite-remove="${escapeHtml(item.path)}">Unpin</button>
            </div>
          </div>
        `,
      )
      .join("");
  }

  if (state.automation.recentRuns.length === 0) {
    recentsEl.innerHTML = `<div class="empty-state">No recent runs yet.</div>`;
  } else {
    recentsEl.innerHTML = normalizeRecentRuns(state.automation.recentRuns)
      .map(
        (item) => `
          <div class="activity-row action-row">
            <div>
              <strong>${escapeHtml(basename(item.scriptPath))}</strong>
              <span>${escapeHtml(item.scriptPath)}${item.deviceId ? ` • ${escapeHtml(item.deviceId)}` : ""}</span>
              <span>${escapeHtml(item.at)}</span>
            </div>
            <div class="item-actions">
              <button class="tiny-btn" data-recent-use="${escapeHtml(item.scriptPath)}" data-device="${escapeHtml(
                item.deviceId || "",
              )}">Reuse</button>
              <button class="tiny-btn" data-recent-run="${escapeHtml(item.scriptPath)}" data-device="${escapeHtml(
                item.deviceId || "",
              )}">Run again</button>
            </div>
          </div>
        `,
      )
      .join("");
  }

  renderDashboardAutomationPanels();

  favoritesEl.querySelectorAll("[data-favorite-use]").forEach((button) => {
    button.addEventListener("click", () => populateAutomationForm(button.dataset.favoriteUse, ""));
  });
  favoritesEl.querySelectorAll("[data-favorite-remove]").forEach((button) => {
    button.addEventListener("click", async () => {
      state.automation.favorites = state.automation.favorites.filter(
        (item) => item.path !== button.dataset.favoriteRemove,
      );
      await saveAutomationState();
      renderFavoritesAndRecents();
    });
  });

  recentsEl.querySelectorAll("[data-recent-use]").forEach((button) => {
    button.addEventListener("click", () =>
      populateAutomationForm(button.dataset.recentUse, button.dataset.device || ""),
    );
  });
  recentsEl.querySelectorAll("[data-recent-run]").forEach((button) => {
    button.addEventListener("click", () =>
      void runAutomation(button.dataset.recentRun, button.dataset.device || ""),
    );
  });
}

function populateAutomationForm(scriptPath, deviceId = "") {
  const scriptInput = document.getElementById("automation-script-path");
  const deviceInput = document.getElementById("automation-device-id");
  if (scriptInput) {
    scriptInput.value = scriptPath;
  }
  if (deviceInput) {
    deviceInput.value = deviceId;
  }
}

async function addFavorite(scriptPath) {
  if (!scriptPath || isFavorite(scriptPath)) {
    return;
  }

  state.automation.favorites.unshift({
    path: scriptPath,
    name: basename(scriptPath),
  });
  state.automation.favorites = state.automation.favorites.slice(0, 10);
  await saveAutomationState();
  renderFavoritesAndRecents();
  showToast("Added to favorites", "success");
}

async function refreshAutomationScripts() {
  const scripts = await window.omniAPI.listAutomationScripts();
  state.automation.scripts = scripts;
  const list = document.getElementById("automation-script-list");
  if (!list) {
    return;
  }

  if (scripts.length === 0) {
    list.innerHTML = `<div class="empty-state">No scripts found in ~/Automation.</div>`;
    return;
  }

  list.innerHTML = scripts
    .map(
      (script) => `
        <div class="script-item-row">
          <button class="script-item" data-script="${escapeHtml(script.path)}">
            <strong>${escapeHtml(script.name)}</strong>
            <span>${escapeHtml(script.path)}</span>
          </button>
          <button class="tiny-btn star-btn ${isFavorite(script.path) ? "active" : ""}" data-favorite="${escapeHtml(
            script.path,
          )}">${isFavorite(script.path) ? "Pinned" : "Pin"}</button>
        </div>
      `,
    )
    .join("");

  list.querySelectorAll(".script-item").forEach((button) => {
    button.addEventListener("click", () => {
      populateAutomationForm(button.dataset.script);
    });
  });

  list.querySelectorAll("[data-favorite]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.stopPropagation();
      await addFavorite(button.dataset.favorite);
      await refreshAutomationScripts();
    });
  });
}

async function runAutomation(scriptOverride = null, deviceOverride = null) {
  const scriptPath = scriptOverride ?? document.getElementById("automation-script-path")?.value.trim();
  const deviceId = deviceOverride ?? document.getElementById("automation-device-id")?.value.trim();

  if (!scriptPath) {
    showToast("Select a script first.", "error");
    return;
  }

  const id = await window.omniAPI.runAutomation({
    scriptPath,
    deviceId,
  });

  state.automation.activeTaskId = id;
  state.automation.recentRuns.unshift({
    scriptPath,
    deviceId,
    at: new Date().toLocaleString(),
  });
  state.automation.recentRuns = normalizeRecentRuns(state.automation.recentRuns);
  await saveAutomationState();
  renderFavoritesAndRecents();
  setTerminalBadge("Task queued", "busy");

  logger.log(`Automation queued: ${id}`, "success");
  showToast(`Queued ${id}`, "success");
}

async function loadSettings() {
  const settings = await window.omniAPI.getSettings();
  state.settings = settings;
  state.automation.favorites = Array.isArray(settings.favoriteScripts) ? settings.favoriteScripts : [];
  state.automation.recentRuns = Array.isArray(settings.recentRuns) ? settings.recentRuns : [];

  const grid = document.getElementById("settings-grid");
  if (!grid) {
    return;
  }

  grid.innerHTML = settingDefinitions
    .map(
      (item) => `
        <div class="setting-card">
          <label class="form-field">
            <span>${escapeHtml(item.label)}</span>
            <input id="setting-${escapeHtml(item.key)}" data-key="${escapeHtml(item.key)}" value="${escapeHtml(
              String(settings[item.key] ?? ""),
            )}">
          </label>
          <div class="button-row">
            <button class="primary-btn small" data-setting-save="${escapeHtml(item.key)}">Save</button>
            <button class="ghost-btn small" data-setting-validate="${escapeHtml(item.key)}">Validate</button>
          </div>
          <div class="validation-copy" id="validation-${escapeHtml(item.key)}"></div>
        </div>
      `,
    )
    .join("");

  grid.querySelectorAll("[data-setting-save]").forEach((button) => {
    button.addEventListener("click", async () => {
      const key = button.dataset.settingSave;
      const input = document.getElementById(`setting-${key}`);
      if (!input) {
        return;
      }

      const rawValue = input.value.trim();
      await window.omniAPI.setSetting(key, rawValue);
      logger.log(`Saved setting: ${key}`, "success");
      showToast(`Saved ${key}`, "success");
    });
  });

  grid.querySelectorAll("[data-setting-validate]").forEach((button) => {
    button.addEventListener("click", async () => {
      const key = button.dataset.settingValidate;
      const input = document.getElementById(`setting-${key}`);
      const output = document.getElementById(`validation-${key}`);
      const definition = settingDefinitions.find((item) => item.key === key);
      if (!input || !output || !definition) {
        return;
      }

      if (!input.value.trim()) {
        output.textContent = "Enter a value first.";
        return;
      }

      const result = await window.omniAPI.validatePath(input.value.trim(), definition.args);
      output.textContent = result.valid
        ? `Valid (exit ${result.code})`
        : `Not valid: ${result.message || result.code}`;
    });
  });
}

function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function basename(filePath) {
  return filePath.split("/").filter(Boolean).pop() || filePath;
}

function pathJoin(base, segment) {
  return base === "/" ? `/${segment}` : `${base}/${segment}`;
}

function updateClock() {
  const now = new Date();
  const clock = document.getElementById("big-clock");
  const date = document.getElementById("date-display");

  if (clock) {
    clock.textContent = now.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }

  if (date) {
    date.textContent = now
      .toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
      .toUpperCase();
  }
}

window.addEventListener("DOMContentLoaded", async () => {
  logger.init();
  logger.log("Renderer boot complete.", "success");
  setTerminalBadge("Idle", "idle");

  document.getElementById("btn-minimize")?.addEventListener("click", () => window.omniAPI.minimize());
  document.getElementById("btn-maximize")?.addEventListener("click", () => window.omniAPI.maximize());
  document.getElementById("btn-close")?.addEventListener("click", () => window.omniAPI.quit());
  document.getElementById("btn-term-clear")?.addEventListener("click", () => logger.clear());
  document.getElementById("btn-term-toggle")?.addEventListener("click", (event) => {
    event.stopPropagation();
    const dock = document.getElementById("term-dock");
    const button = document.getElementById("btn-term-toggle");
    if (!dock || !button) {
      return;
    }
    dock.classList.toggle("expanded");
    button.textContent = dock.classList.contains("expanded") ? "Collapse" : "Expand";
  });
  document.getElementById("term-header")?.addEventListener("click", () => {
    const dock = document.getElementById("term-dock");
    const button = document.getElementById("btn-term-toggle");
    if (!dock || !button) {
      return;
    }
    dock.classList.toggle("expanded");
    button.textContent = dock.classList.contains("expanded") ? "Collapse" : "Expand";
  });

  ["dashboard", "explorer", "automation", "settings"].forEach((view) => {
    document.getElementById(`nav-${view}`)?.addEventListener("click", () => switchView(view));
  });

  document.getElementById("card-explorer")?.addEventListener("click", () => switchView("explorer"));
  document.getElementById("card-automation")?.addEventListener("click", () => switchView("automation"));

  document.getElementById("btn-explorer-refresh")?.addEventListener("click", () => void loadDirectory(state.explorer.path));
  document.getElementById("btn-explorer-up")?.addEventListener("click", async () => {
    if (!state.explorer.path) {
      return;
    }
    const parent = state.explorer.path.split("/").slice(0, -1).join("/") || "/";
    await loadDirectory(parent);
  });
  document.getElementById("explorer-search")?.addEventListener("input", (event) => {
    state.explorer.query = event.target.value;
    renderExplorer();
  });
  document.getElementById("explorer-path")?.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    showExplorerContextMenu(state.explorer.path || "/", true, event.clientX, event.clientY);
  });

  document.getElementById("btn-pick-script")?.addEventListener("click", async () => {
    const result = await window.omniAPI.pickScript();
    if (result) {
      document.getElementById("automation-script-path").value = result;
    }
  });
  document.getElementById("btn-run-automation")?.addEventListener("click", () => void runAutomation());
  document.getElementById("btn-refresh-scripts")?.addEventListener("click", () => void refreshAutomationScripts());
  document.getElementById("btn-file-op-cancel")?.addEventListener("click", () => closeFileOpModal());
  document.getElementById("btn-file-op-cancel-top")?.addEventListener("click", () => closeFileOpModal());
  document.getElementById("btn-file-op-submit")?.addEventListener("click", () => void submitFileOpModal());
  document.getElementById("file-op-input")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void submitFileOpModal();
    }
  });
  document.getElementById("file-op-modal")?.addEventListener("click", (event) => {
    if (event.target.id === "file-op-modal") {
      closeFileOpModal();
    }
  });

  const dropZone = document.getElementById("automation-drop-zone");
  const dropHint = document.getElementById("automation-drop-hint");
  ["dragenter", "dragover"].forEach((eventName) => {
    dropZone?.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.add("drag-active");
      if (dropHint) {
        dropHint.textContent = "Release to load this script into the launcher form.";
      }
    });
  });
  ["dragleave", "dragend", "drop"].forEach((eventName) => {
    dropZone?.addEventListener(eventName, () => {
      dropZone.classList.remove("drag-active");
      if (dropHint) {
        dropHint.textContent = "Drop a `.sh`, `.adb`, or `.bash` file anywhere in this panel to load it.";
      }
    });
  });
  dropZone?.addEventListener("drop", (event) => {
    event.preventDefault();
    const files = [...(event.dataTransfer?.files || [])];
    const script = files.find((file) => /\.(sh|adb|bash)$/i.test(file.path || file.name));
    if (!script) {
      showToast("Drop a shell script file.", "error");
      return;
    }
    populateAutomationForm(script.path);
    showToast("Script loaded from drop", "success");
  });

  window.addEventListener("click", () => hideExplorerContextMenu());
  window.addEventListener("resize", () => hideExplorerContextMenu());
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      hideExplorerContextMenu();
      closeFileOpModal();
    }
    if (event.key === "F2" && state.view === "explorer" && state.explorer.contextPath) {
      showExplorerContextMenu(state.explorer.contextPath, true, 120, 120);
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "n" && state.view === "explorer") {
      event.preventDefault();
      void createFolderInCurrentDirectory();
    }
  });

  window.omniAPI.onSystemPulse((data) => {
    state.system = { ...state.system, ...data };
    document.getElementById("cpu-load").textContent = data.cpu;
    document.getElementById("mem-load").textContent = data.mem;
    document.getElementById("uptime-value").textContent = data.uptime;
    document.getElementById("hero-title").textContent = data.host
      ? `Ready on ${data.host}`
      : "Ready for desktop automation work";
  });

  window.omniAPI.onAdbUpdate((data) => {
    state.system.adb = data.status;
    document.getElementById("adb-status").textContent = data.status;
    if (data.status.toLowerCase().includes("connected")) {
      setTerminalBadge("Device connected", "success");
    } else {
      setTerminalBadge("ADB ready", "idle");
    }
    logger.log(`ADB: ${data.status}`, "sys");
  });

  window.omniAPI.onAdbError((message) => {
    document.getElementById("adb-status").textContent = "ADB unavailable";
    setTerminalBadge("ADB unavailable", "error");
    logger.log(`ADB error: ${message}`, "error");
  });

  window.omniAPI.onFsChanged((data) => {
    if (data.path === state.explorer.path) {
      logger.log(`Filesystem change detected in ${data.path}`, "sys");
      void loadDirectory(state.explorer.path);
    }
  });

  window.omniAPI.onAutomationTask("start", (data) => {
    setTerminalBadge("Running task", "busy");
    logger.log(`Automation started: ${data.id}`, "sys");
  });
  window.omniAPI.onAutomationTask("done", (data) => {
    setTerminalBadge("Last task passed", "success");
    logger.log(`Automation finished: ${data.id}`, "success");
    showToast(`Automation finished: ${data.id}`, "success");
  });
  window.omniAPI.onAutomationTask("error", (data) => {
    setTerminalBadge("Task failed", "error");
    logger.log(`Automation failed: ${data.id} ${data.error}`, "error");
    showToast(`Automation failed: ${data.id}`, "error");
  });
  window.omniAPI.onAutomationTask("log", (data) => {
    logger.log(data.data, data.type || "data");
  });

  updateClock();
  setInterval(updateClock, 1000);

  await loadSettings();
  await loadDirectory(null);
  await refreshAutomationScripts();
  renderFavoritesAndRecents();
  renderDashboardAutomationPanels();
  switchView("dashboard");
});

window.addEventListener("error", (event) => {
  logger.log(`Renderer error: ${event.message}`, "error");
});

window.addEventListener("unhandledrejection", (event) => {
  logger.log(`Unhandled rejection: ${event.reason}`, "error");
});
