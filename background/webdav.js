(() => {
  "use strict";

  const root = globalThis.GhStarsHelperBackground;
  const { constants, utils } = root;
  const { clone } = utils;
  const shared = (globalThis.GhStarsHelper && globalThis.GhStarsHelper.shared) || {};
  const defaultWebdavUrl = shared.DEFAULT_WEBDAV_URL || "https://dav.jianguoyun.com/dav/";
  const defaultRemoteFile = shared.DEFAULT_REMOTE_FILE || "github-stars/stars-metadata.json";

  /**
   * 规范化 WebDAV 根目录，确保以 /dav 结尾的坚果云地址末尾带斜杠。
   */
  function normalizeBase(rawBase) {
    let base = String(rawBase || "").trim() || defaultWebdavUrl;
    if (!/^https?:\/\//i.test(base)) {
      base = `https://${base}`;
    }
    base = base.replace(/\/+$/, "");
    return `${base}/`;
  }

  /**
   * 规范化远端文件路径，去掉首尾斜杠，保留中文并逐段转义。
   */
  function encodeRemotePath(rawPath) {
    const path = String(rawPath || "").trim() || defaultRemoteFile;
    return path
      .replace(/^\/+|\/+$/g, "")
      .split("/")
      .filter((segment) => segment.length > 0)
      .map((segment) => encodeURIComponent(segment))
      .join("/");
  }

  /**
   * 拼出远端文件的完整 URL。
   */
  function buildFileUrl(config) {
    const base = normalizeBase(config && config.webdavUrl);
    const file = encodeRemotePath(config && config.remotePath);
    return `${base}${file}`;
  }

  /**
   * 生成 Basic Auth 头，处理账号或应用密码中的非 ASCII 字符。
   */
  function buildAuthHeader(config) {
    const user = String((config && config.webdavUser) || "");
    const password = String((config && config.webdavPassword) || "");
    const raw = `${user}:${password}`;
    const bytes = unescape(encodeURIComponent(raw));
    return `Basic ${btoa(bytes)}`;
  }

  /**
   * 统一 WebDAV 请求，注入鉴权头并归一化错误。
   */
  async function webdavRequest(url, config, options) {
    const opts = options || {};
    const headers = new Headers(opts.headers || {});
    headers.set("Authorization", buildAuthHeader(config));
    const res = await fetch(url, { ...opts, headers });
    return res;
  }

  /**
   * 逐级创建远端目录，坚果云对已存在目录返回 405，视为成功。
   */
  async function ensureRemoteDir(config) {
    const base = normalizeBase(config && config.webdavUrl);
    const segments = encodeRemotePath(config && config.remotePath).split("/");
    segments.pop();
    let cursor = base.replace(/\/$/, "");
    for (const segment of segments) {
      cursor = `${cursor}/${segment}`;
      let res;
      try {
        res = await webdavRequest(cursor, config, { method: "MKCOL" });
      } catch (error) {
        throw error;
      }
      // 201=新建成功，405=已存在，409=父级冲突，均视为该层就绪。
      if (res.status !== 201 && res.status !== 405 && res.status !== 409 && !res.ok) {
        if (res.status === 401 || res.status === 403) {
          const error = new Error("坚果云鉴权失败，请检查账号与应用密码。");
          error.status = res.status;
          throw error;
        }
        const error = new Error(`创建远端目录失败（HTTP ${res.status}）。`);
        error.status = res.status;
        throw error;
      }
    }
  }

  /**
   * 拉取坚果云上的元数据文件，解析为统一的标准元数据结构。
   */
  async function fetchRemoteMeta(config) {
    const url = buildFileUrl(config);
    const res = await webdavRequest(url, config, { method: "GET" });
    if (res.status === 404) {
      return {
        meta: clone(constants.DEFAULT_META),
        etag: null,
        webdavUrl: url,
        missingFile: true
      };
    }
    if (res.status === 401 || res.status === 403) {
      const error = new Error("坚果云鉴权失败，请检查账号与应用密码。");
      error.status = res.status;
      throw error;
    }
    if (!res.ok) {
      const error = new Error(`读取坚果云文件失败（HTTP ${res.status}）。`);
      error.status = res.status;
      throw error;
    }
    const etag = res.headers.get("etag");
    const text = await res.text();
    let parsed = clone(constants.DEFAULT_META);
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = clone(constants.DEFAULT_META);
    }
    return {
      meta: root.meta.normalizeMeta(parsed),
      etag,
      webdavUrl: url,
      missingFile: false
    };
  }

  /**
   * 写入元数据文件。带 ETag 时用 If-Match 做乐观并发控制；
   * 首次创建用 If-None-Match: * 防止覆盖他人刚创建的文件。
   * force=true 时跳过条件头，用于用户明确选择“保留本地”的强制覆盖。
   */
  async function updateRemoteMeta(config, meta, etag, force) {
    const url = buildFileUrl(config);
    const headers = new Headers();
    headers.set("Content-Type", "application/json; charset=utf-8");
    if (!force) {
      if (etag) {
        headers.set("If-Match", etag);
      } else {
        headers.set("If-None-Match", "*");
      }
    }
    const res = await webdavRequest(url, config, {
      method: "PUT",
      headers,
      body: JSON.stringify(meta, null, 2)
    });
    if (res.status === 412) {
      const error = new Error("ETag mismatch");
      error.code = "etag_mismatch";
      throw error;
    }
    if (res.status === 401 || res.status === 403) {
      const error = new Error("坚果云鉴权失败，请检查账号与应用密码。");
      error.status = res.status;
      throw error;
    }
    // 首次写入时父目录可能不存在，自动创建后重试一次。
    if ((res.status === 404 || res.status === 409) && !force) {
      await ensureRemoteDir(config);
      return updateRemoteMeta(config, meta, etag, force);
    }
    if (!res.ok) {
      const error = new Error(`写入坚果云文件失败（HTTP ${res.status}）。`);
      error.status = res.status;
      throw error;
    }
    return { webdavUrl: url, etag: res.headers.get("etag") || etag };
  }

  /**
   * 首次创建远端文件并初始化目录。
   */
  async function createRemoteFile(config, meta) {
    await ensureRemoteDir(config);
    const result = await updateRemoteMeta(config, meta, null, true);
    return { webdavUrl: result.webdavUrl, etag: result.etag };
  }

  /**
   * 测试坚果云连接：GET 文件地址，200/404 均代表鉴权通过。
   */
  async function testConnection(config) {
    if (!config || !config.webdavUser || !config.webdavPassword) {
      throw new Error("需要填写坚果云账号与应用密码。");
    }
    const url = buildFileUrl(config);
    const res = await webdavRequest(url, config, { method: "GET" });
    if (res.status === 401 || res.status === 403) {
      throw new Error("鉴权失败，请检查账号与应用密码是否为第三方应用密码。");
    }
    if (res.ok || res.status === 404) {
      return { ok: true, user: config.webdavUser, webdavUrl: url };
    }
    throw new Error(`连接失败（HTTP ${res.status}）。`);
  }

  root.webdav = {
    normalizeBase,
    encodeRemotePath,
    buildFileUrl,
    buildAuthHeader,
    ensureRemoteDir,
    fetchRemoteMeta,
    updateRemoteMeta,
    createRemoteFile,
    testConnection
  };
})();
