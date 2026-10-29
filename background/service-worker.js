import { planStartupTabs, tabsNeedingReload } from "../lib/pinned.js";
import { loadSettings } from "../lib/storage.js";
import { clamp } from "../lib/util.js";

const STARTUP_WINDOW_MS = 25000;
const attempted = new Set();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function markStartup() {
  await chrome.storage.session.set({ tinpStartupUntil: Date.now() + STARTUP_WINDOW_MS });
  await chrome.storage.session.remove(["tinpAttempted"]);
  attempted.clear();
}

async function inStartupWindow() {
  const data = await chrome.storage.session.get("tinpStartupUntil");
  return typeof data.tinpStartupUntil === "number" && Date.now() < data.tinpStartupUntil;
}

async function release(tabId) {
  attempted.delete(tabId);
  const data = await chrome.storage.session.get("tinpAttempted");
  const ids = (data.tinpAttempted || []).filter((id) => id !== tabId);
  await chrome.storage.session.set({ tinpAttempted: ids });
}

async function claim(tabId) {
  if (attempted.has(tabId)) return false;
  const data = await chrome.storage.session.get("tinpAttempted");
  const ids = new Set(data.tinpAttempted || []);
  if (ids.has(tabId)) {
    attempted.add(tabId);
    return false;
  }
  ids.add(tabId);
  attempted.add(tabId);
  await chrome.storage.session.set({ tinpAttempted: [...ids] });
  return true;
}

async function ensureStartupUrls(settings) {
  const desired = settings.pinnedTabs.startupUrls || [];
  if (!desired.length) return;
  const existing = await chrome.tabs.query({});
  const plan = planStartupTabs(existing, desired);
  for (const id of plan.pin) {
    try {
      await chrome.tabs.update(id, { pinned: true });
    } catch {
      /* The tab may have closed while we were walking the list. */
    }
  }
  for (const url of plan.create) {
    try {
      await chrome.tabs.create({ url, pinned: true, active: false });
    } catch {
      /* Ignore pages the browser refuses to open. */
    }
  }
}

async function reloadOne(tab) {
  try {
    await chrome.tabs.reload(tab.id);
    return true;
  } catch {
    const url = tab.pendingUrl || tab.url;
    if (!url || url.startsWith("chrome:") || url.startsWith("helium:") || url.startsWith("edge:")) return false;
    try {
      await chrome.tabs.update(tab.id, { url });
      return true;
    } catch {
      return false;
    }
  }
}

async function reloadPinned({ force = false } = {}) {
  const settings = await loadSettings();
  const stagger = clamp(settings.pinnedTabs.staggerMs, 0, 4000);
  const tabs = await chrome.tabs.query({ pinned: true });
  const targets = force ? tabs.filter((tab) => tab.id != null) : tabsNeedingReload(tabs);
  let count = 0;
  for (const tab of targets) {
    if (!force && !(await claim(tab.id))) continue;
    const loaded = await reloadOne(tab);
    if (loaded) count += 1;
    else if (!force) await release(tab.id);
    if (stagger > 0 && targets.length > 1) await sleep(stagger);
  }
  return count;
}

async function handleStartup() {
  await markStartup();
  const settings = await loadSettings();
  await ensureStartupUrls(settings);
  if (!settings.pinnedTabs.reloadOnStartup) return 0;
  const delay = clamp(settings.pinnedTabs.delayMs, 0, 15000);
  if (delay) await sleep(delay);
  let count = await reloadPinned({ force: false });
  await sleep(1200);
  count += await reloadPinned({ force: false });
  await sleep(2200);
  count += await reloadPinned({ force: false });
  return count;
}

async function queueLateTab(tab) {
  if (!tab?.pinned || tab.id == null) return;
  if (!(tab.discarded || tab.status === "unloaded")) return;
  if (!(await inStartupWindow())) return;
  const settings = await loadSettings();
  if (!settings.pinnedTabs.reloadOnStartup) return;
  if (!(await claim(tab.id))) return;
  const wait = clamp(settings.pinnedTabs.delayMs, 0, 15000);
  chrome.alarms.create(`tinp-one-${tab.id}`, { when: Date.now() + Math.max(80, wait) });
}

chrome.runtime.onStartup.addListener(() => {
  const job = handleStartup();
  chrome.alarms.create("tinp-pinned-boot", { when: Date.now() + 1600 });
  return job;
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "tinp-pinned-boot") return reloadPinned({ force: false });
  if (alarm.name.startsWith("tinp-one-")) {
    const id = Number(alarm.name.slice("tinp-one-".length));
    if (!Number.isFinite(id)) return undefined;
    return chrome.tabs.reload(id).catch(() => {});
  }
  return undefined;
});

chrome.tabs.onCreated.addListener((tab) => {
  queueLateTab(tab);
});

chrome.tabs.onUpdated.addListener((_id, change, tab) => {
  if (change.discarded === true || change.status === "unloaded" || tab.discarded || tab.status === "unloaded") {
    queueLateTab(tab);
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "tinp-reload-pinned") return undefined;
  reloadPinned({ force: message.force !== false })
    .then((count) => sendResponse({ ok: true, count }))
    .catch((error) => sendResponse({ ok: false, error: String(error) }));
  return true;
});
