(() => {
  "use strict";

  const root = globalThis.GhStarsHelper;
  const content = root.content;
  const shared = root.shared || {};
  const { state, elements, runtime } = content;
  const t = typeof shared.t === "function"
    ? shared.t
    : (key, substitutions, fallback) => fallback || key;

  /**
   * 获取当前最上层的弹框遮罩。
   */
  function getTopModalOverlay() {
    const overlays = Array.from(document.querySelectorAll(".gh-stars-helper-modal-overlay"));
    if (overlays.length === 0) {
      return null;
    }
    return overlays[overlays.length - 1];
  }

  /**
   * 关闭指定弹框遮罩，优先触发显式取消按钮。
   */
  function closeModalOverlay(overlay) {
    if (!overlay) {
      return false;
    }
    const cancelButton = overlay.querySelector(
      ".gh-stars-helper-modal-cancel, .gh-stars-helper-cancel"
    );
    if (cancelButton) {
      cancelButton.click();
      return true;
    }
    overlay.remove();
    return true;
  }

  /**
   * 处理 Esc 快捷键，优先关闭弹框，其次收起侧边抽屉。
   */
  function handleGlobalKeydown(event) {
    if (event.key !== "Escape") {
      return;
    }
    const path = typeof event.composedPath === "function" ? event.composedPath() : [];
    const fromModal = path.some(
      (node) =>
        node &&
        node.classList &&
        node.classList.contains("gh-stars-helper-modal-overlay")
    );
    const overlay = getTopModalOverlay();
    if (overlay) {
      event.preventDefault();
      closeModalOverlay(overlay);
      return;
    }
    if (fromModal) {
      event.preventDefault();
      return;
    }
    if (elements.drawer && elements.drawer.classList.contains("open")) {
      event.preventDefault();
      toggleDrawer(false);
    }
  }

  /**
   * 绑定全局 Esc 处理器，避免重复注册。
   */
  function ensureEscHandler() {
    if (runtime.escHandlerAttached) {
      return;
    }
    document.addEventListener("keydown", handleGlobalKeydown);
    runtime.escHandlerAttached = true;
  }

  /**
   * 确保悬浮管理按钮存在。
   */
  function ensureManageButton() {
    ensureEscHandler();
    if (elements.manageButton) {
      return;
    }
    if (!document.body) {
      return;
    }
    const button = document.createElement("button");
    button.id = "gh-stars-helper-manage-btn";
    button.className = "gh-stars-helper-manage-btn floating";
    button.type = "button";
    button.textContent = t("manageButtonLabel", null, "github-starts");
    button.addEventListener("click", () => {
      if (runtime.suppressManageButtonClick) {
        return;
      }
      toggleDrawer(true);
    });
    document.body.appendChild(button);
    // 首次注入时闪烁两下，提示悬浮按钮入口。
    window.requestAnimationFrame(() => {
      button.classList.add("attention");
      button.addEventListener(
        "animationend",
        () => {
          button.classList.remove("attention");
        },
        { once: true }
      );
    });
    content.storage.setupManageButtonDrag(button);
    elements.manageButton = button;
    window.requestAnimationFrame(() => {
      content.storage.applyManageButtonPosition(button);
    });
    if (!runtime.manageButtonResizeAttached) {
      let resizeRaf = null;
      window.addEventListener("resize", () => {
        if (!elements.manageButton) {
          return;
        }
        if (resizeRaf) {
          return;
        }
        resizeRaf = window.requestAnimationFrame(() => {
          resizeRaf = null;
          content.storage.applyManageButtonPosition(elements.manageButton);
        });
      });
      runtime.manageButtonResizeAttached = true;
    }
  }

  /**
   * 统一标签分隔符，确保中英文逗号都能被正常识别。
   */
  function normalizeCommaInput(value) {
    return value.replace(/，/g, ",");
  }

  /**
   * 绑定输入框清空按钮，并保持可见状态与输入值同步。
   */
  function bindInputClear(input, clearButton) {
    if (!input || !clearButton) {
      return;
    }
    const syncVisibility = () => {
      clearButton.classList.toggle("visible", input.value.length > 0);
    };
    clearButton.addEventListener("click", () => {
      input.value = "";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.focus();
    });
    input.addEventListener("input", syncVisibility);
    syncVisibility();
  }

  /**
   * 创建抽屉与遮罩结构，并绑定交互事件。
   */
  function ensureDrawer() {
    if (elements.drawer) {
      return;
    }
    const overlay = document.createElement("div");
    overlay.id = "gh-stars-helper-overlay";
    overlay.className = "gh-stars-helper-overlay";

    const drawer = document.createElement("aside");
    drawer.id = "gh-stars-helper-drawer";
    drawer.className = "gh-stars-helper-drawer";
    drawer.innerHTML = `
      <div class="gh-stars-helper-header">
        <div class="gh-stars-helper-title">${t("appName", null, "Stars Manager")}</div>
        <div class="gh-stars-helper-stats">
          <span class="gh-stars-helper-stat-item">
            <span class="gh-stars-helper-stat-label">${t("labelStarsColon", null, "星标:")}</span>
            <span class="gh-stars-helper-stat-value gh-stars-helper-stars-count">0</span>
          </span>
          <span class="gh-stars-helper-stat-item">
            <span class="gh-stars-helper-stat-label">${t("labelGroupsColon", null, "分组:")}</span>
            <span class="gh-stars-helper-stat-value gh-stars-helper-groups-count">0</span>
          </span>
        </div>
        <button class="gh-stars-helper-close" type="button">×</button>
      </div>
      <div class="gh-stars-helper-status">
        <div class="gh-stars-helper-status-row">
          <div class="gh-stars-helper-status-info">
            <span class="gh-stars-helper-status-text"></span>
            <span class="gh-stars-helper-pending"></span>
          </div>
          <div class="gh-stars-helper-status-actions">
            <button class="gh-stars-helper-sync" type="button">${t("btnSync", null, "同步")}</button>
            <button class="gh-stars-helper-options" type="button">${t("btnSettings", null, "设置")}</button>
            <button class="gh-stars-helper-help" type="button">${t("btnHelp", null, "帮助")}</button>
          </div>
        </div>
        <div class="gh-stars-helper-options-hint">
          <span class="gh-stars-helper-options-message"></span>
          <a class="gh-stars-helper-options-link" href="#" target="_blank" rel="noopener">
            ${t("linkOpenSettings", null, "打开设置")}
          </a>
        </div>
        <div class="gh-stars-helper-conflict">
          <div class="gh-stars-helper-conflict-title">${t("conflictTitle", null, "检测到多端冲突")}</div>
          <div class="gh-stars-helper-conflict-desc">
            ${t("conflictDesc", null, "坚果云远端文件已更新，请选择保留版本。")}
          </div>
          <div class="gh-stars-helper-conflict-actions">
            <button class="gh-stars-helper-conflict-remote" type="button">${t("conflictKeepRemote", null, "保留远端")}</button>
            <button class="gh-stars-helper-conflict-local" type="button">${t("conflictKeepLocal", null, "保留本地")}</button>
            <button class="gh-stars-helper-conflict-open" type="button">${t("conflictOpenRemote", null, "查看远端文件")}</button>
          </div>
        </div>
      </div>
      <div class="gh-stars-helper-filters">
        <div class="gh-stars-helper-input-wrap">
          <input class="gh-stars-helper-search" type="search" placeholder="${t("placeholderSearch", null, "搜索分组或仓库")}" />
          <button class="gh-stars-helper-input-clear gh-stars-helper-search-clear" type="button" aria-label="${t("ariaClearSearch", null, "清空搜索")}">×</button>
        </div>
        <select class="gh-stars-helper-group-select" aria-label="${t("groupSelectLabel", null, "按分组筛选")}">
          <option value="">${t("groupSelectAll", null, "全部分组")}</option>
        </select>
        <div class="gh-stars-helper-input-wrap">
          <input class="gh-stars-helper-tags" type="text" placeholder="${t("placeholderTags", null, "筛选标签（逗号分隔）")}" />
          <button class="gh-stars-helper-input-clear gh-stars-helper-tags-clear" type="button" aria-label="${t("ariaClearTags", null, "清空标签")}">×</button>
        </div>
        <select class="gh-stars-helper-sort">
          <option value="starred_desc">${t("sortStarredDesc", null, "星标时间（新到旧）")}</option>
          <option value="starred_asc">${t("sortStarredAsc", null, "星标时间（旧到新）")}</option>
          <option value="name_asc">${t("sortNameAsc", null, "名称（A-Z）")}</option>
          <option value="name_desc">${t("sortNameDesc", null, "名称（Z-A）")}</option>
          <option value="meta_desc">${t("sortMetaDesc", null, "项目更新时间（新到旧）")}</option>
          <option value="meta_asc">${t("sortMetaAsc", null, "项目更新时间（旧到新）")}</option>
        </select>
      </div>
      <div class="gh-stars-helper-body">
        <div class="gh-stars-helper-groups">
          <div class="gh-stars-helper-section-header">
            <span>${t("sectionGroups", null, "分组")}</span>
            <div class="gh-stars-helper-section-actions">
              <button class="gh-stars-helper-flat-toggle" type="button" title="${t("btnFlatView", null, "不按分组，平铺展示全部星标")}">${t("btnFlatViewShort", null, "平铺")}</button>
              <button class="gh-stars-helper-toggle-all" type="button" title="${t("btnToggleAll", null, "展开/折叠全部")}">${t("btnToggleAll", null, "展开/折叠")}</button>
              <button class="gh-stars-helper-add-group" type="button">${t("btnAddGroup", null, "新增")}</button>
            </div>
          </div>
          <div class="gh-stars-helper-group-tree"></div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(drawer);

    elements.overlay = overlay;
    elements.drawer = drawer;
    elements.starsCount = drawer.querySelector(".gh-stars-helper-stars-count");
    elements.groupsCount = drawer.querySelector(".gh-stars-helper-groups-count");
    elements.statusText = drawer.querySelector(".gh-stars-helper-status-text");
    elements.pendingText = drawer.querySelector(".gh-stars-helper-pending");
    elements.syncButton = drawer.querySelector(".gh-stars-helper-sync");
    elements.optionsButton = drawer.querySelector(".gh-stars-helper-options");
    elements.helpButton = drawer.querySelector(".gh-stars-helper-help");
    elements.optionsHint = drawer.querySelector(".gh-stars-helper-options-hint");
    elements.optionsMessage = drawer.querySelector(".gh-stars-helper-options-message");
    elements.optionsLink = drawer.querySelector(".gh-stars-helper-options-link");
    elements.conflictBox = drawer.querySelector(".gh-stars-helper-conflict");
    elements.conflictKeepRemote = drawer.querySelector(".gh-stars-helper-conflict-remote");
    elements.conflictKeepLocal = drawer.querySelector(".gh-stars-helper-conflict-local");
    elements.conflictOpenRemote = drawer.querySelector(".gh-stars-helper-conflict-open");
    elements.groupSelect = drawer.querySelector(".gh-stars-helper-group-select");
    elements.flatToggleButton = drawer.querySelector(".gh-stars-helper-flat-toggle");
    elements.toggleAllButton = drawer.querySelector(".gh-stars-helper-toggle-all");
    elements.searchInput = drawer.querySelector(".gh-stars-helper-search");
    elements.tagInput = drawer.querySelector(".gh-stars-helper-tags");
    elements.sortSelect = drawer.querySelector(".gh-stars-helper-sort");
    elements.groupTree = drawer.querySelector(".gh-stars-helper-group-tree");
    const searchClear = drawer.querySelector(".gh-stars-helper-search-clear");
    const tagsClear = drawer.querySelector(".gh-stars-helper-tags-clear");

    overlay.addEventListener("click", () => toggleDrawer(false));
    drawer.querySelector(".gh-stars-helper-close").addEventListener("click", () => toggleDrawer(false));
    elements.syncButton.addEventListener("click", () => content.api.syncNow("manual"));
    elements.optionsButton.addEventListener("click", () => openOptions());
    elements.helpButton.addEventListener("click", () => openHelpModal());
    if (elements.conflictKeepRemote) {
      elements.conflictKeepRemote.addEventListener("click", async () => {
        await content.api.resolveConflictDecision("keep_remote");
      });
    }
    if (elements.conflictKeepLocal) {
      elements.conflictKeepLocal.addEventListener("click", async () => {
        await content.api.resolveConflictDecision("keep_local");
      });
    }
    if (elements.conflictOpenRemote) {
      elements.conflictOpenRemote.addEventListener("click", () => openRemoteFromConfig());
    }
    if (elements.groupSelect) {
      elements.groupSelect.addEventListener("change", (event) => {
        state.filter.groupId = event.target.value || "";
        renderAll();
      });
    }
    if (elements.flatToggleButton) {
      elements.flatToggleButton.addEventListener("click", () => {
        state.filter.flat = !state.filter.flat;
        elements.flatToggleButton.classList.toggle("active", state.filter.flat);
        elements.flatToggleButton.textContent = t(
          state.filter.flat ? "btnGroupedViewShort" : "btnFlatViewShort",
          null,
          state.filter.flat ? "分组" : "平铺"
        );
        renderAll();
      });
    }
    if (elements.toggleAllButton) {
      elements.toggleAllButton.addEventListener("click", () => {
        content.groups.toggleAllGroups();
      });
    }
    elements.searchInput.addEventListener("input", (event) => {
      state.filter.query = event.target.value.trim();
      renderAll();
    });
    elements.tagInput.addEventListener("input", (event) => {
      const normalized = normalizeCommaInput(event.target.value);
      if (normalized !== event.target.value) {
        event.target.value = normalized;
      }
      state.filter.tag = event.target.value.trim();
      renderAll();
    });
    elements.sortSelect.addEventListener("change", (event) => {
      state.filter.sort = event.target.value;
      renderAll();
    });
    bindInputClear(elements.searchInput, searchClear);
    bindInputClear(elements.tagInput, tagsClear);
    drawer.querySelector(".gh-stars-helper-add-group").addEventListener("click", () => content.groups.addGroup(null));
  }

  /**
   * 切换侧边抽屉显示状态。
   */
  function toggleDrawer(open) {
    if (!elements.drawer || !elements.overlay) {
      ensureDrawer();
    }
    if (!elements.drawer || !elements.overlay) {
      return;
    }
    const shouldOpen = open === undefined ? !elements.drawer.classList.contains("open") : open;
    elements.drawer.classList.toggle("open", shouldOpen);
    elements.overlay.classList.toggle("open", shouldOpen);
    if (elements.manageButton) {
      elements.manageButton.classList.toggle("hidden", shouldOpen);
    }
    if (shouldOpen) {
      content.api.refreshState();
    }
  }

  /**
   * 清理抽屉顶部的配置提示。
   */
  function clearOptionsHint() {
    if (elements.optionsHint) {
      elements.optionsHint.classList.remove("visible");
    }
  }

  /**
   * 显示配置提示，引导用户打开设置页面。
   */
  function showOptionsHint(url, message) {
    if (elements.optionsMessage) {
      elements.optionsMessage.textContent = message;
    }
    if (elements.optionsLink) {
      elements.optionsLink.href = url;
    }
    if (elements.optionsHint) {
      elements.optionsHint.classList.add("visible");
    }
  }

  /**
   * 弹出设置窗口并处理配置保存逻辑。
   */
  function openSettingsModal() {
    clearOptionsHint();
    const existing = document.querySelector(".gh-stars-helper-settings-overlay");
    if (existing) {
      existing.remove();
    }
    const overlay = document.createElement("div");
    overlay.className = "gh-stars-helper-modal-overlay gh-stars-helper-settings-overlay";
    overlay.innerHTML = `
      <div class="gh-stars-helper-modal gh-stars-helper-settings-modal">
        <h3>${t("modalSettingsTitle", null, "设置")}</h3>
        <details class="gh-stars-helper-setup-guide">
          <summary>${t("setupTitle", null, "初始化步骤")}</summary>
          <div class="gh-stars-helper-setup-content">
            <p><strong>${t("setupStep1Title", null, "1. 生成 GitHub PAT")}</strong></p>
            <p>
              ${t("setupStep1DescPrefix", null, "访问")}
              <a href="https://github.com/settings/tokens?type=classic" target="_blank" rel="noopener">
                ${t("setupStep1DescLink", null, "GitHub Token 设置")}
              </a>
              ${t("setupStep1DescSuffix", null, "，点击 Generate new token (classic)，勾选权限：")}
            </p>
            <ul>
              <li>${t("setupStep1ScopeRepo", null, "<code>read:user</code>（必需）；私有星标需 <code>repo</code>")}</li>
            </ul>
            <p><strong>${t("setupStep2Title", null, "2. 生成坚果云应用密码")}</strong></p>
            <p>
              ${t("setupStep2DescPrefix", null, "在坚果云「账户信息 → 安全选项 → 第三方应用管理」中添加应用密码，不要用登录密码。WebDAV 地址为")}
              <code>https://dav.jianguoyun.com/dav/</code>
            </p>
            <p><strong>${t("setupStep3Title", null, "3. 保存配置")}</strong></p>
            <p>${t("setupStep3Desc", null, "填写 PAT 与坚果云账号、应用密码后，点击\"保存\"，并分别测试 Token 与坚果云连接")}</p>
          </div>
        </details>
        <div class="gh-stars-helper-field">
          <label>${t("fieldPat", null, "GitHub PAT")}</label>
          <input class="gh-stars-helper-input gh-stars-helper-input-pat" type="password" placeholder="${t("placeholderPat", null, "ghp_xxx")}" />
        </div>
        <div class="gh-stars-helper-field">
          <label class="gh-stars-helper-check-label">
            <input class="gh-stars-helper-input-sync-lists" type="checkbox" checked />
            <span>${t("fieldSyncLists", null, "同步 GitHub Lists 为分组")}</span>
          </label>
          <p class="gh-stars-helper-hint">${t("hintSyncLists", null, "需要 PAT 勾选 user 权限；每个 List 会显示为一种颜色的分组。")}</p>
        </div>
        <div class="gh-stars-helper-field">
          <label>${t("fieldWebdavUrl", null, "WebDAV 地址")}</label>
          <input class="gh-stars-helper-input gh-stars-helper-input-webdav-url" type="text" placeholder="https://dav.jianguoyun.com/dav/" />
        </div>
        <div class="gh-stars-helper-field">
          <label>${t("fieldWebdavUser", null, "坚果云账号")}</label>
          <input class="gh-stars-helper-input gh-stars-helper-input-webdav-user" type="text" placeholder="you@example.com" />
        </div>
        <div class="gh-stars-helper-field">
          <label>${t("fieldWebdavPassword", null, "应用密码")}</label>
          <input class="gh-stars-helper-input gh-stars-helper-input-webdav-password" type="password" placeholder="${t("placeholderWebdavPassword", null, "第三方应用密码，非登录密码")}" />
        </div>
        <div class="gh-stars-helper-field">
          <label>${t("fieldRemotePath", null, "同步文件路径")}</label>
          <input class="gh-stars-helper-input gh-stars-helper-input-remote-path" type="text" placeholder="github-stars/stars-metadata.json" />
        </div>
        <div class="gh-stars-helper-modal-actions gh-stars-helper-settings-actions">
          <button class="gh-stars-helper-save" type="button">${t("btnSave", null, "保存")}</button>
          <button class="gh-stars-helper-test" type="button">${t("btnTestToken", null, "测试 Token")}</button>
          <button class="gh-stars-helper-test-webdav" type="button">${t("btnTestWebdav", null, "测试坚果云")}</button>
          <button class="gh-stars-helper-cancel" type="button">${t("btnClose", null, "关闭")}</button>
        </div>
        <div class="gh-stars-helper-settings-status" role="status"></div>
      </div>
    `;
    document.body.appendChild(overlay);
    const statusEl = overlay.querySelector(".gh-stars-helper-settings-status");
    const patInput = overlay.querySelector(".gh-stars-helper-input-pat");
    const syncListsInput = overlay.querySelector(".gh-stars-helper-input-sync-lists");
    const webdavUrlInput = overlay.querySelector(".gh-stars-helper-input-webdav-url");
    const webdavUserInput = overlay.querySelector(".gh-stars-helper-input-webdav-user");
    const webdavPasswordInput = overlay.querySelector(".gh-stars-helper-input-webdav-password");
    const remotePathInput = overlay.querySelector(".gh-stars-helper-input-remote-path");
    const saveButton = overlay.querySelector(".gh-stars-helper-save");
    const testButton = overlay.querySelector(".gh-stars-helper-test");
    const testWebdavButton = overlay.querySelector(".gh-stars-helper-test-webdav");
    const cancelButton = overlay.querySelector(".gh-stars-helper-cancel");
    const defaultWebdavUrl = shared.DEFAULT_WEBDAV_URL || "https://dav.jianguoyun.com/dav/";
    const defaultRemoteFile = shared.DEFAULT_REMOTE_FILE || "github-stars/stars-metadata.json";

    // 汇总当前表单中的配置。
    const collectConfig = () => ({
      pat: patInput.value.trim(),
      syncLists: syncListsInput.checked,
      webdavUrl: webdavUrlInput.value.trim() || defaultWebdavUrl,
      webdavUser: webdavUserInput.value.trim(),
      webdavPassword: webdavPasswordInput.value.trim(),
      remotePath: remotePathInput.value.trim() || defaultRemoteFile
    });

    // 更新设置弹窗内的状态提示。
    const setLocalStatus = (message, isError) => {
      if (!statusEl) {
        return;
      }
      statusEl.textContent = message;
      statusEl.classList.toggle("error", Boolean(isError));
    };

    // 关闭设置弹窗并释放 DOM。
    const cleanup = () => {
      overlay.remove();
    };

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        cleanup();
      }
    });
    if (cancelButton) {
      cancelButton.addEventListener("click", cleanup);
    }

    if (saveButton) {
      saveButton.addEventListener("click", async () => {
        const res = await shared.sendMessage("save_config", { config: collectConfig() });
        if (!res.ok) {
          setLocalStatus(res.error || t("statusSaveFailed", null, "保存失败。"), true);
          return;
        }
        setLocalStatus(t("statusSaved", null, "已保存。"));
        content.api.refreshState();
      });
    }

    if (testButton) {
      testButton.addEventListener("click", async () => {
        const pat = patInput.value.trim();
        const res = await shared.sendMessage("test_token", { pat });
        if (!res.ok) {
          setLocalStatus(res.error || t("statusTokenTestFailed", null, "Token 测试失败。"), true);
          return;
        }
        let msg = t("statusTokenOk", [res.login || ""], `Token 验证通过：${res.login || ""}`);
        if (res.listsStatus === "ok") {
          msg += " · " + t("statusListsCount", [res.listsCount], `Lists: ${res.listsCount}`);
        } else if (res.listsStatus === "no_scope") {
          msg += " · " + t("errorListsScope", null, "PAT 缺少 user 权限，无法读取 Lists");
        }
        setLocalStatus(msg);
      });
    }

    if (testWebdavButton) {
      testWebdavButton.addEventListener("click", async () => {
        const res = await shared.sendMessage("test_webdav", { config: collectConfig() });
        if (!res.ok) {
          setLocalStatus(
            res.error || t("errorWebdavTestFailed", null, "坚果云连接测试失败。"),
            true
          );
          return;
        }
        setLocalStatus(
          t("statusWebdavOk", [res.user || ""], `坚果云连接成功：${res.user || ""}`)
        );
      });
    }

    (async () => {
      const res = await shared.sendMessage("get_config");
      if (!res.ok) {
        setLocalStatus(res.error || t("statusLoadConfigFailed", null, "加载配置失败。"), true);
        return;
      }
      const config = res.config || {};
      patInput.value = config.pat || "";
      syncListsInput.checked = config.syncLists !== false;
      webdavUrlInput.value = config.webdavUrl || defaultWebdavUrl;
      webdavUserInput.value = config.webdavUser || "";
      webdavPasswordInput.value = config.webdavPassword || "";
      remotePathInput.value = config.remotePath || defaultRemoteFile;
    })();
  }

  /**
   * 打开设置入口，便于后续扩展。
   */
  function openOptions() {
    openSettingsModal();
  }

  /**
   * 打开使用帮助说明。
   */
  function openHelpModal() {
    const existing = document.querySelector(".gh-stars-helper-help-overlay");
    if (existing) {
      existing.remove();
    }
    const overlay = document.createElement("div");
    overlay.className = "gh-stars-helper-modal-overlay gh-stars-helper-help-overlay";
    overlay.innerHTML = `
      <div class="gh-stars-helper-modal gh-stars-helper-settings-modal">
        <h3>${t("modalHelpTitle", null, "使用帮助")}</h3>
        <div class="gh-stars-helper-setup-content">
          <p><strong>${t("helpBasicsTitle", null, "基本功能")}</strong></p>
          <p>${t("helpBasicsDesc", null, "管理 GitHub 星标仓库，支持分组、标签、备注，通过坚果云在多设备间同步。")}</p>

          <p><strong>${t("helpGroupsTitle", null, "分组管理")}</strong></p>
          <ul>
            <li>${t("helpGroupsItem1", null, "点击分组名称即可过滤星标列表")}</li>
            <li>${t("helpGroupsItem2", null, "支持拖拽分组调整层级")}</li>
            <li>${t("helpGroupsItem3", null, "点击分组操作按钮可新增、重命名或删除")}</li>
          </ul>

          <p><strong>${t("helpReposTitle", null, "仓库管理")}</strong></p>
          <ul>
            <li>${t("helpReposItem1", null, "在列表中点击编辑按钮可管理分组、标签和备注")}</li>
            <li>${t("helpReposItem2", null, "在仓库详情页可快速编辑当前仓库信息")}</li>
            <li>${t("helpReposItem3", null, "如果未 Star 会自动 Star 并打开编辑器")}</li>
          </ul>

          <p><strong>${t("helpSyncTitle", null, "同步")}</strong></p>
          <ul>
            <li>${t("helpSyncItem1", null, "点击同步按钮手动拉取最新星标与元数据")}</li>
            <li>${t("helpSyncItem2", null, "检测到冲突时可选择保留本地或远端版本")}</li>
          </ul>
        </div>
        <div class="gh-stars-helper-modal-actions">
          <button class="gh-stars-helper-cancel" type="button">${t("btnClose", null, "关闭")}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector(".gh-stars-helper-cancel").addEventListener("click", () => overlay.remove());
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        overlay.remove();
      }
    });
  }

  /**
   * 打开坚果云网页版，方便查看同步文件所在的同步空间。
   */
  function openRemoteFromConfig() {
    window.open("https://www.jianguoyun.com/#/home", "_blank", "noopener");
  }

  /**
   * 显示冲突处理对话框。
   */
  function showConflictDialog() {
    if (!elements.drawer) {
      return;
    }
    const overlay = document.createElement("div");
    overlay.className = "gh-stars-helper-modal-overlay";
    overlay.innerHTML = `
      <div class="gh-stars-helper-modal">
        <h3>${t("conflictTitle", null, "检测到多端冲突")}</h3>
        <p>${t("conflictDesc", null, "坚果云远端文件已更新，请选择保留版本。")}</p>
        <div class="gh-stars-helper-modal-actions">
          <button class="gh-stars-helper-keep-remote" type="button">${t("conflictKeepRemote", null, "保留远端")}</button>
          <button class="gh-stars-helper-keep-local" type="button">${t("conflictKeepLocal", null, "保留本地")}</button>
          <button class="gh-stars-helper-open-remote" type="button">${t("conflictOpenRemote", null, "查看远端文件")}</button>
          <button class="gh-stars-helper-cancel" type="button">${t("btnCancel", null, "取消")}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    // 关闭冲突弹窗并恢复页面交互。
    const cleanup = () => {
      overlay.remove();
    };

    overlay.querySelector(".gh-stars-helper-cancel").addEventListener("click", cleanup);
    overlay.querySelector(".gh-stars-helper-keep-remote").addEventListener("click", async () => {
      await content.api.resolveConflictDecision("keep_remote");
      cleanup();
    });
    overlay.querySelector(".gh-stars-helper-keep-local").addEventListener("click", async () => {
      await content.api.resolveConflictDecision("keep_local");
      cleanup();
    });
    overlay.querySelector(".gh-stars-helper-open-remote").addEventListener("click", () => {
      openRemoteFromConfig();
      cleanup();
    });
  }

  /**
   * 更新抽屉状态文本。
   */
  function setStatus(message, isError) {
    if (!elements.statusText) {
      return;
    }
    elements.statusText.textContent = message;
    elements.statusText.classList.toggle("error", Boolean(isError));
  }

  /**
   * 渲染同步状态、错误提示与待同步数量。
   */
  function renderStatus() {
    if (!elements.statusText || !elements.pendingText) {
      return;
    }
    const status = state.syncStatus || { state: "idle", message: "" };
    let text = "";
    if (status.state === "syncing") {
      text = status.message || t("statusSyncing", null, "同步中...");
      if (elements.syncButton) {
        elements.syncButton.classList.add("syncing");
        elements.syncButton.disabled = true;
      }
      elements.statusText.classList.add("syncing");
    } else {
      if (elements.syncButton) {
        elements.syncButton.classList.remove("syncing");
        elements.syncButton.disabled = false;
      }
      elements.statusText.classList.remove("syncing");
    }
    if (status.state === "error") {
      const errorLabel = t("statusErrorPrefix", null, "错误: ");
      text = `${errorLabel}${status.message || t("errorSyncFailed", null, "同步失败")}`;
    } else if (status.state === "conflict") {
      text = t("statusConflictPrompt", null, "检测到冲突，请选择处理方式。");
    } else if (!state.config || !state.config.hasPat || !state.config.webdavUser) {
      text = t("statusNeedConfig", null, "需要配置");
    } else if (status.state !== "syncing") {
      text = status.message || t("statusSynced", null, "已同步");
      if (status.updated_at) {
        const lastSync = new Date(status.updated_at);
        const now = new Date();
        const diffMs = now - lastSync;
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 1) {
          text += ` (${t("statusJustNow", null, "刚刚")})`;
        } else if (diffMins < 60) {
          text += ` (${t("statusMinutesAgo", [diffMins], `${diffMins}分钟前`)})`;
        } else {
          const diffHours = Math.floor(diffMins / 60);
          text += ` (${t("statusHoursAgo", [diffHours], `${diffHours}小时前`)})`;
        }
      }
    }
    if (state.pendingOpsCount > 0) {
      elements.pendingText.textContent = t(
        "statusPendingOps",
        [state.pendingOpsCount],
        `待同步: ${state.pendingOpsCount}`
      );
    } else {
      elements.pendingText.textContent = "";
    }
    if (elements.conflictBox) {
      elements.conflictBox.classList.toggle("visible", state.conflict);
    }
    elements.statusText.textContent = text;
  }

  /**
   * 渲染统计信息。
   */
  function renderStats() {
    if (!elements.starsCount || !elements.groupsCount) {
      return;
    }
    const starsCount = Object.keys(state.stars?.items || {}).length;
    const groupsCount = (state.meta?.groups || []).length;
    elements.starsCount.textContent = starsCount;
    elements.groupsCount.textContent = groupsCount;
  }

  /**
   * 执行全量 UI 刷新。
   */
  function renderAll() {
    renderStats();
    renderStatus();
    content.groups.renderGroupTree();
    content.page.updatePageEntries();
  }

  /**
   * 使用 DOM 构建输入弹窗，避免字符串插值引入注入风险。
   */
  function showInputModal(title, defaultValue, callback) {
    const inputOverlay = document.createElement("div");
    inputOverlay.className = "gh-stars-helper-modal-overlay";

    const modal = document.createElement("div");
    modal.className = "gh-stars-helper-modal";

    const header = document.createElement("h3");
    header.textContent = title;

    const field = document.createElement("div");
    field.className = "gh-stars-helper-field";

    const input = document.createElement("input");
    input.type = "text";
    input.className = "gh-stars-helper-input";
    input.placeholder = t("inputPlaceholderName", null, "输入名称");
    input.value = defaultValue || "";

    field.appendChild(input);

    const actions = document.createElement("div");
    actions.className = "gh-stars-helper-modal-actions";

    const confirmBtn = document.createElement("button");
    confirmBtn.type = "button";
    confirmBtn.className = "gh-stars-helper-modal-confirm";
    confirmBtn.textContent = t("btnConfirm", null, "确定");

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "gh-stars-helper-modal-cancel";
    cancelBtn.textContent = t("btnCancel", null, "取消");

    actions.appendChild(confirmBtn);
    actions.appendChild(cancelBtn);

    modal.appendChild(header);
    modal.appendChild(field);
    modal.appendChild(actions);
    inputOverlay.appendChild(modal);

    const handleConfirm = () => {
      const value = input.value.trim();
      if (value) {
        callback(value);
      }
      inputOverlay.remove();
    };
    const handleCancel = () => {
      inputOverlay.remove();
    };
    confirmBtn.addEventListener("click", handleConfirm);
    cancelBtn.addEventListener("click", handleCancel);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        handleConfirm();
      } else if (e.key === "Escape") {
        handleCancel();
      }
    });
    inputOverlay.addEventListener("click", (e) => {
      if (e.target === inputOverlay) {
        handleCancel();
      }
    });
    document.body.appendChild(inputOverlay);
    input.focus();
    input.select();
  }

  /**
   * 显示确认弹窗，统一侧边抽屉内的危险操作提示样式。
   */
  function showConfirmModal(title, message, onConfirm, options) {
    const config = options && typeof options === "object" ? options : {};
    const confirmText = config.confirmText || t("btnConfirm", null, "确定");
    const cancelText = config.cancelText || t("btnCancel", null, "取消");
    const overlay = document.createElement("div");
    overlay.className = "gh-stars-helper-modal-overlay";

    const modal = document.createElement("div");
    modal.className = "gh-stars-helper-modal";

    const header = document.createElement("h3");
    header.textContent = title;

    const description = document.createElement("p");
    description.textContent = message;

    const actions = document.createElement("div");
    actions.className = "gh-stars-helper-modal-actions";

    const confirmBtn = document.createElement("button");
    confirmBtn.type = "button";
    confirmBtn.className = "gh-stars-helper-modal-confirm";
    confirmBtn.textContent = confirmText;

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "gh-stars-helper-modal-cancel";
    cancelBtn.textContent = cancelText;

    actions.appendChild(confirmBtn);
    actions.appendChild(cancelBtn);

    modal.appendChild(header);
    modal.appendChild(description);
    modal.appendChild(actions);
    overlay.appendChild(modal);

    const cleanup = () => {
      overlay.remove();
    };
    confirmBtn.addEventListener("click", async () => {
      try {
        await Promise.resolve(onConfirm && onConfirm());
      } finally {
        cleanup();
      }
    });
    cancelBtn.addEventListener("click", cleanup);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        cleanup();
      }
    });
    document.body.appendChild(overlay);
  }

  content.ui = {
    ensureManageButton,
    ensureDrawer,
    toggleDrawer,
    clearOptionsHint,
    showOptionsHint,
    openSettingsModal,
    openOptions,
    openHelpModal,
    openRemoteFromConfig,
    showConflictDialog,
    setStatus,
    renderStatus,
    renderStats,
    renderAll,
    showInputModal,
    showConfirmModal
  };
})();
