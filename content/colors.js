(() => {
  "use strict";

  const root = globalThis.GhStarsHelper || (globalThis.GhStarsHelper = {});
  const content = root.content || (root.content = {});

  // 调色板：每个分组按稳定顺序分配一种颜色，标签按文本哈希取色。
  // 每个颜色自带浅色背景与深色文字，保证在 GitHub 浅色/深色页面上都清晰可读。
  const PALETTE = [
    { name: "blue", bg: "#ddf4ff", fg: "#0969da", border: "#b6e3ff" },
    { name: "green", bg: "#dafbe1", fg: "#116329", border: "#aceebb" },
    { name: "purple", bg: "#fbefff", fg: "#8250df", border: "#e6d6ff" },
    { name: "orange", bg: "#fff1e5", fg: "#9a4e00", border: "#ffd8a8" },
    { name: "rose", bg: "#ffebe9", fg: "#a40e26", border: "#ffcecb" },
    { name: "teal", bg: "#d2f7ee", fg: "#0f766e", border: "#9ee6d5" },
    { name: "indigo", bg: "#eef2ff", fg: "#3730a3", border: "#c7d2fe" },
    { name: "amber", bg: "#fff8c5", fg: "#7d4e00", border: "#fae17d" },
    { name: "cyan", bg: "#e0f7fa", fg: "#0e7490", border: "#a5e9f2" },
    { name: "lime", bg: "#eefbe0", fg: "#4d7c0f", border: "#cdf5a8" },
    { name: "fuchsia", bg: "#fdf0ff", fg: "#a21caf", border: "#f5c2fc" },
    { name: "coral", bg: "#fff0f6", fg: "#a40e3a", border: "#ffd0e0" }
  ];

  /**
   * 稳定字符串哈希，保证同一文本在任何设备上都映射到同一序号。
   */
  function hashString(value) {
    const text = String(value == null ? "" : value);
    let hash = 5381;
    for (let i = 0; i < text.length; i += 1) {
      hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
  }

  /**
   * 按稳定顺序为全部分组分配颜色，返回 groupId -> color 的映射。
   * 排序键包含名称与 id，确保同一份分组数据在任意设备上得到相同配色。
   */
  function buildGroupColorMap(groups) {
    const list = Array.isArray(groups) ? groups.slice() : [];
    list.sort((a, b) => {
      const orderDiff = (a.order || 0) - (b.order || 0);
      if (orderDiff !== 0) {
        return orderDiff;
      }
      const nameDiff = String(a.name || "").localeCompare(String(b.name || ""));
      if (nameDiff !== 0) {
        return nameDiff;
      }
      return String(a.id || "").localeCompare(String(b.id || ""));
    });
    const map = new Map();
    list.forEach((group, index) => {
      map.set(group.id, PALETTE[index % PALETTE.length]);
    });
    return map;
  }

  /**
   * 取单个分组的颜色，未知分组回退到哈希取色。
   */
  function groupColor(groupId, groups) {
    const map = buildGroupColorMap(groups);
    if (map.has(groupId)) {
      return map.get(groupId);
    }
    return PALETTE[hashString(groupId) % PALETTE.length];
  }

  /**
   * 标签颜色：同一标签文本在所有仓库中显示同一种颜色。
   */
  function tagColor(tag) {
    return PALETTE[hashString(String(tag || "").toLowerCase()) % PALETTE.length];
  }

  /**
   * 构建一个彩色标签 DOM 元素。
   */
  function createChip(text, color) {
    const chip = document.createElement("span");
    chip.className = "gh-stars-helper-chip";
    const palette = color || PALETTE[0];
    chip.style.backgroundColor = palette.bg;
    chip.style.color = palette.fg;
    chip.style.borderColor = palette.border;
    chip.textContent = text;
    chip.title = text;
    return chip;
  }

  /**
   * 根据分组 ID 列表构建彩色分组标签容器。
   */
  function createGroupChips(groupIds, groups, groupPathMap) {
    const wrap = document.createElement("span");
    wrap.className = "gh-stars-helper-chip-wrap";
    const colorMap = buildGroupColorMap(groups);
    const pathMap = groupPathMap || {};
    (Array.isArray(groupIds) ? groupIds : []).forEach((id) => {
      const label = pathMap[id] || id;
      wrap.appendChild(createChip(label, colorMap.get(id)));
    });
    return wrap;
  }

  /**
   * 根据标签文本列表构建彩色标签容器。
   */
  function createTagChips(tags) {
    const wrap = document.createElement("span");
    wrap.className = "gh-stars-helper-chip-wrap";
    (Array.isArray(tags) ? tags : []).forEach((tag) => {
      wrap.appendChild(createChip(tag, tagColor(tag)));
    });
    return wrap;
  }

  content.colors = {
    PALETTE,
    hashString,
    buildGroupColorMap,
    groupColor,
    tagColor,
    createChip,
    createGroupChips,
    createTagChips
  };
})();
