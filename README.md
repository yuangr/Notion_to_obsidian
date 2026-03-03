# Obsidian Notion Importer

在 Obsidian 中搜索和导入 Notion 文档的插件。

## 功能

- 🔍 **搜索 Notion 文档** - 在 Obsidian 内搜索你的 Notion 页面
- 📥 **导入到 Obsidian** - 将 Notion 页面转换为 Markdown 并保存
- 🔄 **智能更新** - 重复导入时自动更新已存在的文件
- 📝 **保留元数据** - 自动添加 Notion URL 和 ID 到文件属性

## 安装

### 手动安装

1. 下载最新 [Release](https://github.com/yuangr/Notion_to_obsidian/releases) 中的 `main.js` 和 `manifest.json`
2. 在 Obsidian vault 的 `.obsidian/plugins/` 目录下创建 `notion-importer` 文件夹
3. 将下载的文件复制到该文件夹
4. 重启 Obsidian
5. 在设置 → 第三方插件中启用 "Notion Importer"

## 配置

1. 访问 [Notion Integrations](https://www.notion.so/my-integrations) 创建一个 Integration
2. 复制 Integration Token（以 `secret_` 开头）
3. 在 Notion 中将 Integration 添加到你想搜索的页面（页面右上角 ⋮ → Connections）
4. 在 Obsidian 插件设置中粘贴 Token

## 使用

- 按 `Ctrl+P` 打开命令面板，输入 "Import from Notion"
- 或点击左侧边栏的图标
- 在搜索框中输入关键词
- 选择文档即可导入

## 导入位置

导入的文档保存在 vault 根目录的 `Notion_Search/` 文件夹中。

## 开发

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建
npm run build
```

## License

MIT
