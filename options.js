const sharedRoot = window.GhStarsHelper ? window.GhStarsHelper.shared : null;
const sendMessage = sharedRoot ? sharedRoot.sendMessage : null;
const t = sharedRoot && typeof sharedRoot.t === "function"
  ? sharedRoot.t
  : (key, substitutions, fallback) => fallback || key;
const defaultWebdavUrl = sharedRoot && sharedRoot.DEFAULT_WEBDAV_URL
  ? sharedRoot.DEFAULT_WEBDAV_URL
  : "https://dav.jianguoyun.com/dav/";
const defaultRemoteFile = sharedRoot && sharedRoot.DEFAULT_REMOTE_FILE
  ? sharedRoot.DEFAULT_REMOTE_FILE
  : "github-stars/stars-metadata.json";

const statusEl = document.getElementById("status");
const patInput = document.getElementById("pat");
const syncListsInput = document.getElementById("syncLists");
const webdavUrlInput = document.getElementById("webdavUrl");
const webdavUserInput = document.getElementById("webdavUser");
const webdavPasswordInput = document.getElementById("webdavPassword");
const remotePathInput = document.getElementById("remotePath");
const saveBtn = document.getElementById("save");
const testBtn = document.getElementById("test");
const testWebdavBtn = document.getElementById("testWebdav");

/**
 * 更新设置页的状态提示。
 */
function setStatus(message, isError) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", Boolean(isError));
}

/**
 * 读取当前配置并回填表单。
 */
async function loadConfig() {
  if (!sendMessage) {
    setStatus(t("errorInitFailed", null, "扩展初始化失败。"), true);
    return;
  }
  const res = await sendMessage("get_config");
  if (!res.ok) {
    setStatus(res.error || t("statusLoadConfigFailed", null, "加载配置失败。"), true);
    return;
  }
  const config = res.config || {};
  patInput.value = config.pat || "";
  syncListsInput.checked = config.syncLists !== false;
  webdavUrlInput.value = config.webdavUrl || defaultWebdavUrl;
  webdavUserInput.value = config.webdavUser || "";
  webdavPasswordInput.value = config.webdavPassword || "";
  remotePathInput.value = config.remotePath || defaultRemoteFile;
}

/**
 * 从表单收集配置。
 */
function collectConfig() {
  return {
    pat: patInput.value.trim(),
    syncLists: syncListsInput.checked,
    webdavUrl: webdavUrlInput.value.trim() || defaultWebdavUrl,
    webdavUser: webdavUserInput.value.trim(),
    webdavPassword: webdavPasswordInput.value.trim(),
    remotePath: remotePathInput.value.trim() || defaultRemoteFile
  };
}

saveBtn.addEventListener("click", async () => {
  if (!sendMessage) {
    setStatus(t("errorInitFailed", null, "扩展初始化失败。"), true);
    return;
  }
  const res = await sendMessage("save_config", { config: collectConfig() });
  if (!res.ok) {
    setStatus(res.error || t("statusSaveFailed", null, "保存失败。"), true);
    return;
  }
  setStatus(t("statusSaved", null, "已保存。"));
});

testBtn.addEventListener("click", async () => {
  if (!sendMessage) {
    setStatus(t("errorInitFailed", null, "扩展初始化失败。"), true);
    return;
  }
  const pat = patInput.value.trim();
  const res = await sendMessage("test_token", { pat });
  if (!res.ok) {
    setStatus(res.error || t("statusTokenTestFailed", null, "Token 测试失败。"), true);
    return;
  }
  let msg = t("statusTokenOk", [res.login || ""], `Token 验证通过：${res.login || ""}`);
  if (res.listsStatus === "ok") {
    msg += " · " + t("statusListsCount", [res.listsCount], `Lists: ${res.listsCount}`);
  } else if (res.listsStatus === "no_scope") {
    msg += " · " + t("errorListsScope", null, "PAT 缺少 user 权限，无法读取 Lists");
  } else if (res.listsStatus === "error") {
    msg += " · " + t("errorListsFailed", null, "Lists 读取失败");
  }
  setStatus(msg);
});

testWebdavBtn.addEventListener("click", async () => {
  if (!sendMessage) {
    setStatus(t("errorInitFailed", null, "扩展初始化失败。"), true);
    return;
  }
  const res = await sendMessage("test_webdav", { config: collectConfig() });
  if (!res.ok) {
    setStatus(res.error || t("errorWebdavTestFailed", null, "坚果云连接测试失败。"), true);
    return;
  }
  setStatus(t("statusWebdavOk", [res.user || ""], `坚果云连接成功：${res.user || ""}`));
});

if (sharedRoot && typeof sharedRoot.applyI18n === "function") {
  sharedRoot.applyI18n(document);
}

loadConfig();
