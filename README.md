# Obsidian Notion Importer

在 Obsidian 中搜索和无缝导入 Notion 文档的强大插件。

## ✨ 核心功能

- 🔍 **搜索 Notion 文档** - 直接在 Obsidian 的命令面板或侧边栏搜索你的 Notion 页面。
- 📥 **一键导入为 Markdown** - 完美将 Notion 页面内容及格式转换为 Obsidian 原生的 Markdown 格式。
- 🔄 **智能防重复与更新** - 再次导入已存在的文档时，插件会自动将新内容更新到现有文件中，而不会产生副本。
- 📝 **保留元数据 (Frontmatter)** - 自动将 Notion 原始的 URL、ID 以及其它相关属性写入文件的 frontmatter。

## 📦 安装指南

### 方法一：通过 BRAT (推荐)
1. 安装 [Obsidian42 - BRAT](https://github.com/TfTHacker/obsidian42-brat) 插件。
2. 在 BRAT 的设置中，点击 "Add Beta plugin"。
3. 输入本项目地址：`yuangr/Notion_to_obsidian`
4. 在 Obsidian 的“第三方插件”列表中启用 `Notion Importer`。

### 方法二：手动安装
1. 前往 GitHub [Release](https://github.com/yuangr/Notion_to_obsidian/releases) 页面，下载最新的 `main.js` 和 `manifest.json` 文件。
2. 在 Obsidian 仓库目录的 `.obsidian/plugins/` 下创建一个名为 `notion-importer` 的文件夹。
3. 将下载的文件移动至该文件夹。
4. 重启 Obsidian，在设置 → 第三方插件中启用该插件。

## ⚙️ 配置说明

1. 访问 [Notion Integrations](https://www.notion.so/my-integrations) 官网，点击 "New integration" 创建一个新的集成。
2. 在新创建的 integration 设置中，复制并保存你的 **Internal Integration Secret** （即 Token，通常以 `ntn_` 或 `secret_` 开头）。
3. 打开你想导入的 Notion 页面，点击右上角的 **`...` (More) -> Add connections**，然后搜索并增加你刚刚创建的 Integration。
4. 打开 Obsidian 插件设置页，将复制的 Token 粘贴到 Notion API Token 的输入框中。

## 🚀 使用方法

- 按下 `Ctrl+P` (或 `Cmd+P`) 唤出命令面板，输入 **"Import from Notion"**。
- 或者，直接点击 Obsidian 左侧边栏的 **Notion 图标**。
- 在弹出的搜索框中，输入你想查找的关键词。
- 从结果列表中选择相应的文档即可开始导入。

> **注意：** 导入的所有文档将默认保存在 vault 根目录自动创建的 `Notion_Search/` 文件夹中。

## 🛠 开发指南

如果你想参与开发或自行构建该插件：

```bash
# 1. 下载依赖
npm install

# 2. 运行开发模式（自动监听变动并编译）
npm run dev

# 3. 构建发布版本
npm run build
```

## 📄 License

MIT
