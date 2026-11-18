(() => {
  "use strict";

  const root = globalThis.GhStarsHelper;
  const content = root.content;

  /**
   * 把 ISO 日期格式化为简短可读文本（YYYY-MM-DD）。
   */
  function formatShortDate(value) {
    if (!value || typeof value !== "string") {
      return "";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "";
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  /**
   * 判断是否处于全站 Stars 页面。
   */
  function isGlobalStarsPage() {
    return window.location.pathname.startsWith("/stars");
  }

  /**
   * 判断是否处于用户主页的 Stars 标签页。
   */
  function isUserStarsPage() {
    const url = new URL(window.location.href);
    if (url.searchParams.get("tab") !== "stars") {
      return false;
    }
    const parts = url.pathname.split("/").filter(Boolean);
    return parts.length === 1;
  }

  /**
   * 判断是否是可注入列表增强的 Stars 列表页面。
   */
  function isStarsListPage() {
    return isGlobalStarsPage() || isUserStarsPage();
  }

  /**
   * 从页面元信息解析当前仓库全名。
   */
  function getRepoFullNameFromPage() {
    const meta = document.querySelector('meta[name="octolytics-dimension-repository_nwo"]');
    if (!meta) {
      return "";
    }
    const contentValue = meta.getAttribute("content");
    return contentValue ? contentValue.trim() : "";
  }

  /**
   * 判断当前页面是否为具体仓库页。
   */
  function isRepoPage() {
    return Boolean(getRepoFullNameFromPage());
  }

  /**
   * 从链接中提取仓库全名，忽略星标或非仓库链接。
   */
  function parseRepoFullName(href) {
    if (!href || typeof href !== "string") {
      return "";
    }
    if (href.startsWith("http")) {
      try {
        const url = new URL(href);
        href = url.pathname;
      } catch {
        return "";
      }
    }
    if (href.includes("?") || href.includes("#")) {
      href = href.split(/[?#]/)[0];
    }
    const parts = href.split("/").filter(Boolean);
    if (parts.length < 2) {
      return "";
    }
    if (parts[0] === "stars") {
      return "";
    }
    return `${parts[0]}/${parts[1]}`;
  }

  content.utils = {
    formatShortDate,
    isGlobalStarsPage,
    isUserStarsPage,
    isStarsListPage,
    getRepoFullNameFromPage,
    isRepoPage,
    parseRepoFullName
  };
})();
