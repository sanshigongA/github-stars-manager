(() => {
  "use strict";

  const root = globalThis.GhStarsHelperBackground;
  const { constants, utils } = root;
  const { clone, nowIso } = utils;

  const GQL_ENDPOINT = "https://api.github.com/graphql";
  const LIST_ID_PREFIX = "ghlist:";
  const MAX_LIST_PAGES = 20;
  const MAX_ITEM_PAGES = 100;

  const LISTS_QUERY = `query($cursor: String) {
    viewer {
      lists(first: 100, after: $cursor) {
        nodes { id name description }
        pageInfo { hasNextPage endCursor }
      }
    }
  }`;

  const ITEMS_QUERY = `query($listId: ID!, $cursor: String) {
    node(id: $listId) {
      ... on UserList {
        items(first: 100, after: $cursor) {
          nodes { ... on Repository { nameWithOwner } }
          pageInfo { hasNextPage endCursor }
        }
      }
    }
  }`;

  /**
   * 统一 GraphQL 请求，鉴权与错误归一化。
   */
  async function graphql(token, query, variables) {
    const res = await fetch(GQL_ENDPOINT, {
      method: "POST",
      headers: {
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Authorization": `bearer ${token}`
      },
      body: JSON.stringify({ query, variables: variables || {} })
    });
    if (!res.ok) {
      const error = new Error(`GitHub GraphQL HTTP ${res.status}`);
      error.status = res.status;
      if (res.status === 401 || res.status === 403) {
        error.code = "insufficient_scope";
      }
      throw error;
    }
    const body = await res.json();
    if (body.errors && body.errors.length > 0) {
      const messages = body.errors.map((item) => item.message || "GraphQL error").join("; ");
      const error = new Error(messages);
      error.graphql = body.errors;
      if (/scope|permission|insufficient|forbidden/i.test(messages)) {
        error.code = "insufficient_scope";
      }
      throw error;
    }
    return body.data || {};
  }

  /**
   * 拉取用户全部 GitHub Lists 及其成员仓库。
   */
  async function fetchGitHubLists(token) {
    if (!token) {
      throw new Error("需要填写 PAT。");
    }
    const lists = [];
    let cursor = null;
    for (let page = 0; page < MAX_LIST_PAGES; page += 1) {
      const data = await graphql(token, LISTS_QUERY, { cursor });
      const viewer = data.viewer || {};
      const connection = viewer.lists || {};
      (connection.nodes || []).forEach((node) => {
        if (!node || !node.id) {
          return;
        }
        lists.push({
          id: String(node.id),
          name: String(node.name || "").trim(),
          description: String(node.description || "")
        });
      });
      const info = connection.pageInfo || {};
      if (!info.hasNextPage) {
        break;
      }
      cursor = info.endCursor;
    }

    for (const list of lists) {
      const repos = [];
      let itemCursor = null;
      for (let page = 0; page < MAX_ITEM_PAGES; page += 1) {
        const data = await graphql(token, ITEMS_QUERY, {
          listId: list.id,
          cursor: itemCursor
        });
        const node = data.node || {};
        const connection = node.items || {};
        (connection.nodes || []).forEach((item) => {
          if (item && item.nameWithOwner) {
            repos.push(item.nameWithOwner);
          }
        });
        const info = connection.pageInfo || {};
        if (!info.hasNextPage) {
          break;
        }
        itemCursor = info.endCursor;
      }
      list.repos = Array.from(new Set(repos));
    }

    return { lists };
  }

  /**
   * 轻量探测 Lists 是否可读，用于设置页 Token 测试。
   */
  async function checkListsAccess(token) {
    const data = await graphql(token, LISTS_QUERY, { cursor: null });
    const viewer = data.viewer || {};
    const connection = viewer.lists || {};
    return { ok: true, count: (connection.nodes || []).length };
  }

  /**
   * 判断分组 ID 是否属于 GitHub Lists 映射。
   */
  function isListGroupId(groupId) {
    return typeof groupId === "string" && groupId.indexOf(LIST_ID_PREFIX) === 0;
  }

  /**
   * 只为 Lists 相关的分组与仓库归属生成签名，避免无关字段变化触发无谓写入。
   */
  function buildListsSignature(meta) {
    const groups = [];
    const members = [];
    (meta.groups || []).forEach((group) => {
      if (isListGroupId(group.id)) {
        groups.push(`${group.id}|${group.name}|${group.order || 0}`);
      }
    });
    Object.keys(meta.repo_meta || {}).forEach((repo) => {
      const info = meta.repo_meta[repo] || {};
      const ids = (Array.isArray(info.group_ids) ? info.group_ids : [])
        .filter(isListGroupId);
      if (ids.length > 0) {
        members.push(`${repo}|${ids.slice().sort().join(",")}`);
      }
    });
    groups.sort();
    members.sort();
    return JSON.stringify({ groups, members });
  }

  /**
   * 把 GitHub Lists 映射为只读分组并合并进元数据：
   * 保留用户自定义分组与标签备注，只替换 Lists 部分。
   * starredOnly 用于限定只映射当前仍星标的仓库，避免与清理逻辑反复拉锯。
   */
  function applyListsToMeta(meta, lists, starredOnly) {
    const next = root.meta.normalizeMeta(clone(meta));
    const before = buildListsSignature(next);
    const listGroups = (Array.isArray(lists) ? lists : []).map((list, index) => ({
      id: `${LIST_ID_PREFIX}${list.id}`,
      name: String(list.name || "").trim() || "(未命名 List)",
      parent_id: null,
      order: index + 1
    }));
    const starSet = Array.isArray(starredOnly) ? new Set(starredOnly) : null;

    const membership = new Map();
    (Array.isArray(lists) ? lists : []).forEach((list) => {
      const groupId = `${LIST_ID_PREFIX}${list.id}`;
      (Array.isArray(list.repos) ? list.repos : []).forEach((repo) => {
        if (!repo || (starSet && !starSet.has(repo))) {
          return;
        }
        if (!membership.has(repo)) {
          membership.set(repo, new Set());
        }
        membership.get(repo).add(groupId);
      });
    });

    const userGroups = next.groups.filter((group) => !isListGroupId(group.id));
    next.groups = userGroups.concat(listGroups);
    const validIds = new Set(next.groups.map((group) => group.id));

    const allRepos = new Set([
      ...Object.keys(next.repo_meta || {}),
      ...Array.from(membership.keys())
    ]);
    allRepos.forEach((repo) => {
      const info = next.repo_meta[repo] && typeof next.repo_meta[repo] === "object"
        ? next.repo_meta[repo]
        : {};
      const userGroupIds = (Array.isArray(info.group_ids) ? info.group_ids : [])
        .filter((id) => !isListGroupId(id) && validIds.has(id));
      const addedIds = membership.has(repo) ? Array.from(membership.get(repo)) : [];
      const groupIds = Array.from(new Set(userGroupIds.concat(addedIds)));
      const tags = Array.isArray(info.tags)
        ? info.tags.map((tag) => String(tag).trim()).filter(Boolean)
        : [];
      const note = typeof info.note === "string" ? info.note.trim() : "";
      if (groupIds.length === 0 && tags.length === 0 && note.length === 0) {
        delete next.repo_meta[repo];
        return;
      }
      next.repo_meta[repo] = {
        group_ids: groupIds,
        tags,
        note,
        updated_at: typeof info.updated_at === "string" ? info.updated_at : nowIso()
      };
    });

    const after = buildListsSignature(next);
    return { meta: next, changed: before !== after };
  }

  root.githubLists = {
    LIST_ID_PREFIX,
    isListGroupId,
    fetchGitHubLists,
    checkListsAccess,
    applyListsToMeta
  };
})();
