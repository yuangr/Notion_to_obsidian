var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// converter.ts
var NotionConverter = class {
  constructor(notionService) {
    this.notionService = notionService;
  }
  pageToMarkdown(pageId) {
    return __async(this, null, function* () {
      const blocks = yield this.notionService.getBlocks(pageId);
      return yield this.blocksToMarkdown(blocks);
    });
  }
  blocksToMarkdown(blocks, indentLevel = 0) {
    return __async(this, null, function* () {
      const lines = [];
      for (const block of blocks) {
        const md = yield this.blockToMarkdown(block);
        if (md) {
          if (indentLevel > 0 && this.isListItem(block.type)) {
            const indent = "    ".repeat(indentLevel);
            lines.push(indent + md);
          } else {
            lines.push(md);
          }
        }
        if (block.has_children) {
          const children = yield this.notionService.getBlockChildren(block.id);
          const nextIndent = this.isListItem(block.type) ? indentLevel + 1 : 0;
          const childMd = yield this.blocksToMarkdown(children, nextIndent);
          if (childMd) {
            lines.push(childMd);
          }
        }
      }
      return lines.join("\n\n");
    });
  }
  // 判断块类型是否为列表项（需要保持层级缩进）
  isListItem(type) {
    return ["bulleted_list_item", "numbered_list_item", "to_do"].includes(type);
  }
  blockToMarkdown(block) {
    return __async(this, null, function* () {
      var _a, _b, _c, _d, _e, _f, _g;
      const type = block.type;
      const content = block[type];
      switch (type) {
        case "paragraph":
          return this.richTextToMarkdown((content == null ? void 0 : content.rich_text) || []);
        case "heading_1":
          return `# ${this.richTextToMarkdown((content == null ? void 0 : content.rich_text) || [])}`;
        case "heading_2":
          return `## ${this.richTextToMarkdown((content == null ? void 0 : content.rich_text) || [])}`;
        case "heading_3":
          return `### ${this.richTextToMarkdown((content == null ? void 0 : content.rich_text) || [])}`;
        case "bulleted_list_item":
          return `- ${this.richTextToMarkdown((content == null ? void 0 : content.rich_text) || [])}`;
        case "numbered_list_item":
          return `1. ${this.richTextToMarkdown((content == null ? void 0 : content.rich_text) || [])}`;
        case "to_do":
          const checked = (content == null ? void 0 : content.checked) ? "x" : " ";
          return `- [${checked}] ${this.richTextToMarkdown((content == null ? void 0 : content.rich_text) || [])}`;
        case "toggle":
          const toggleText = this.richTextToMarkdown((content == null ? void 0 : content.rich_text) || []);
          return `> [!info]- ${toggleText}`;
        case "quote":
          const quoteText = this.richTextToMarkdown((content == null ? void 0 : content.rich_text) || []);
          return quoteText.split("\n").map((line) => `> ${line}`).join("\n");
        case "callout":
          const calloutIcon = ((_a = content == null ? void 0 : content.icon) == null ? void 0 : _a.emoji) || "";
          const calloutText = this.richTextToMarkdown((content == null ? void 0 : content.rich_text) || []);
          const calloutType = this.mapCalloutType(calloutIcon);
          return `> [!${calloutType}]
> ${calloutText}`;
        case "code":
          const language = (content == null ? void 0 : content.language) || "";
          const code = this.richTextToMarkdown((content == null ? void 0 : content.rich_text) || []);
          return `\`\`\`${language}
${code}
\`\`\``;
        case "divider":
          return "---";
        case "image":
          const imageUrl = ((_b = content == null ? void 0 : content.file) == null ? void 0 : _b.url) || ((_c = content == null ? void 0 : content.external) == null ? void 0 : _c.url) || "";
          const imageName = ((_d = content == null ? void 0 : content.caption) == null ? void 0 : _d.length) > 0 ? this.richTextToMarkdown(content.caption) : this.extractFileName(imageUrl) || "\u56FE\u7247";
          return `![${imageName}](${imageUrl})`;
        case "bookmark":
          const bookmarkUrl = (content == null ? void 0 : content.url) || "";
          const bookmarkCaption = ((_e = content == null ? void 0 : content.caption) == null ? void 0 : _e.length) > 0 ? this.richTextToMarkdown(content.caption) : bookmarkUrl;
          return `[${bookmarkCaption}](${bookmarkUrl})`;
        case "link_preview":
          return `[${(content == null ? void 0 : content.url) || ""}](${(content == null ? void 0 : content.url) || ""})`;
        case "equation":
          return `$$
${(content == null ? void 0 : content.expression) || ""}
$$`;
        case "table_of_contents":
          return "";
        case "child_page":
          return `\u{1F4C4} [[${(content == null ? void 0 : content.title) || "Untitled"}]]`;
        case "child_database":
          return `\u{1F4CA} [[${(content == null ? void 0 : content.title) || "Untitled Database"}]]`;
        case "embed":
        case "video":
        case "file":
        case "pdf":
          const fileUrl = ((_f = content == null ? void 0 : content.file) == null ? void 0 : _f.url) || ((_g = content == null ? void 0 : content.external) == null ? void 0 : _g.url) || (content == null ? void 0 : content.url) || "";
          const fileName = (content == null ? void 0 : content.name) || this.extractFileName(fileUrl) || "\u6587\u4EF6";
          return `[${fileName}](${fileUrl})`;
        default:
          console.log(`Unsupported block type: ${type}`);
          return "";
      }
    });
  }
  richTextToMarkdown(richText) {
    if (!richText || richText.length === 0) {
      return "";
    }
    return richText.map((text) => {
      let content = text.plain_text || "";
      if (!text.annotations) {
        return content;
      }
      if (text.annotations.code) {
        content = `\`${content}\``;
      }
      if (text.annotations.bold) {
        content = `**${content}**`;
      }
      if (text.annotations.italic) {
        content = `*${content}*`;
      }
      if (text.annotations.strikethrough) {
        content = `~~${content}~~`;
      }
      if (text.annotations.underline) {
        content = `<u>${content}</u>`;
      }
      if (text.annotations.color && text.annotations.color.includes("background")) {
        content = `==${content}==`;
      }
      if (text.href) {
        content = `[${content}](${text.href})`;
      }
      return content;
    }).join("");
  }
  // 将 Notion 图标映射到 Obsidian Callout 类型
  mapCalloutType(icon) {
    const iconMap = {
      "\u{1F4A1}": "tip",
      "\u26A0\uFE0F": "warning",
      "\u2757": "important",
      "\u{1F4DD}": "note",
      "\u2705": "success",
      "\u274C": "failure",
      "\u{1F525}": "danger",
      "\u2753": "question",
      "\u{1F4AC}": "quote",
      "\u{1F4CC}": "abstract",
      "\u{1F41B}": "bug",
      "\u{1F4D6}": "example",
      "\u{1F517}": "info"
    };
    return iconMap[icon] || "note";
  }
  // 从 URL 中提取文件名
  extractFileName(url) {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const fileName = pathname.split("/").pop() || "";
      return decodeURIComponent(fileName.split("?")[0]);
    } catch (e) {
      return "";
    }
  }
};
export {
  NotionConverter
};
