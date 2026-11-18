(() => {
  "use strict";

  const root = globalThis.GhStarsHelper || (globalThis.GhStarsHelper = {});
  root.shared = root.shared || {};
  const shared = root.shared;

  // 共享常量用于保持背景页、内容脚本与设置页的规则一致。
  shared.DEFAULT_WEBDAV_URL = "https://dav.jianguoyun.com/dav/";
  shared.DEFAULT_REMOTE_FILE = "github-stars/stars-metadata.json";
  shared.GHLIST_GROUP_PREFIX = "ghlist:";
  shared.MAX_GROUP_DEPTH = 5;
})();
