# GitHub Stars Manager（坚果云同步版）

一个管理 GitHub 星标仓库的 Chrome 扩展，支持分组、标签、备注，并通过坚果云 WebDAV 在多设备间同步。

## 功能

- **分组管理**：树状分组（最多 5 层），每个分组有独立颜色；GitHub 原生 Lists 自动映射为彩色只读分组
- **标签与备注**：给任意星标仓库打标签、写备注，按标签筛选
- **多视图**：分组树视图 / 平铺视图一键切换；按分组下拉筛选
- **信息展示**：星标日期、项目更新日期，四列对齐
- **多端同步**：分组/标签/备注存到坚果云 WebDAV；GitHub PAT 负责拉取星标列表与 Lists
- **冲突处理**：ETag 乐观并发，远端变更时保留本地并提示决策

## 安装

### 方式一：加载已解压的扩展（开发用）

1. 打开 `chrome://extensions/`
2. 开启右上角「开发者模式」
3. 点击「加载已解压的扩展程序」，选择本目录
4. 浏览器工具栏固定 `github-starts` 按钮

### 方式二：安装 CRX

由于 Chrome 对 CRX 安装的限制，通常需通过开发者模式加载；CRX 仅作为分发/备份使用。

## 配置

首次使用点击工具栏按钮或扩展设置页，填写：

| 字段 | 说明 |
| --- | --- |
| GitHub PAT | Classic Token，需 `repo`、`read:user`；读 Lists 需 `user` scope |
| 同步 GitHub Lists | 开启后把 GitHub Lists 映射为彩色分组 |
| WebDAV 地址 | 默认 `https://dav.jianguoyun.com/dav/` |
| 坚果云账号 | 注册邮箱 |
| 应用密码 | 坚果云「第三方应用密码」，非登录密码 |
| 同步文件路径 | 默认 `github-stars/stars-metadata.json` |

填写后先点「测试 Token」和「测试坚果云」验证连接，再同步。

## 同步机制

- 星标列表：GitHub REST `GET /user/starred`
- GitHub Lists：GraphQL `viewer.lists` + 分页拉取成员
- 元数据：坚果云 WebDAV，PUT/GET + ETag + If-Match 乐观锁
- 上次拉取的 ETag 用于增量请求，减少 API 消耗

## 目录结构

```
manifest.json          扩展清单（MV3）
background.js          后台入口（importScripts 聚合）
background/            GitHub、Lists、WebDAV、同步、状态、元数据等
content.js             内容脚本入口
content/               Star 页面注入、分组树、UI、颜色等
shared/                共享常量、i18n、消息封装
options.*              设置页
tokens.css / content.css  设计令牌与样式
_locales/              中英文文案
```

## 隐私

- PAT 与坚果云密码只存本地 `chrome.storage`，不随元数据上传
- 坚果云文件只含分组、标签、备注等元数据，不含凭证

## 赞赏

如果这个扩展帮到了你，欢迎扫码赞赏，支持后续维护与更新。

![赞赏码](docs/appreciation-qr.jpg)

## 许可

MIT
