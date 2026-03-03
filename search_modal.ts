import { App, SuggestModal, Notice } from 'obsidian';
import { NotionService } from './notion';
import { NotionConverter } from './converter';

interface NotionPage {
    id: string;
    properties: Record<string, any>;
    url: string;
    icon: any;
    title: string;
    lastEditedTime: string;
}

export class NotionSearchModal extends SuggestModal<NotionPage> {
    private notionService: NotionService;
    private notionConverter: NotionConverter;

    constructor(app: App, notionService: NotionService, notionConverter: NotionConverter) {
        super(app);
        this.notionService = notionService;
        this.notionConverter = notionConverter;

        this.setPlaceholder("Search Notion pages...");
    }

    // Returns all available suggestions.
    async getSuggestions(query: string): Promise<NotionPage[]> {
        if (!query) {
            return [];
        }

        try {
            const results = await this.notionService.search(query);

            // Filter only pages and map to a simpler structure if needed
            return results
                .filter((item: any) => item.object === 'page')
                .map((page: any) => {
                    // Extract title safely
                    let title = "Untitled";
                    // Notion properties structure varies, simple check for common title-like properties
                    // This is a simplification. Real implementation needs robust property parsing.
                    // For now, let's assume standard 'title' or 'Name' property exists for database pages,
                    // or look at the title property in general.
                    // Using a helper would be better, but keeping it simple for now.

                    const props = page.properties;
                    for (const key in props) {
                        if (props[key].type === 'title') {
                            const titleItems = props[key].title;
                            if (titleItems && titleItems.length > 0) {
                                title = titleItems.map((t: any) => t.plain_text).join("");
                            }
                            break;
                        }
                    }

                    return {
                        id: page.id,
                        properties: page.properties,
                        url: page.url,
                        icon: page.icon,
                        title: title,
                        lastEditedTime: page.last_edited_time
                    };
                });

        } catch (error) {
            console.error("Error fetching suggestions:", error);
            new Notice("Error searching Notion. Check console.");
            return [];
        }
    }

    // Renders each suggestion item.
    renderSuggestion(page: NotionPage, el: HTMLElement) {
        const container = el.createEl("div", { cls: "notion-search-item" });

        // 显示图标和标题
        const icon = page.icon?.emoji || '📄';
        container.createEl("div", {
            text: `${icon} ${page.title}`,
            cls: "notion-search-title"
        });

        // 显示最后编辑时间
        const editDate = new Date(page.lastEditedTime).toLocaleDateString('zh-CN');
        container.createEl("small", {
            text: `最后编辑: ${editDate}`,
            cls: "notion-search-meta"
        });
    }

    // 查找已存在的具有相同 notion_id 的文件
    private async findFileByNotionId(notionId: string): Promise<any | null> {
        const files = this.app.vault.getMarkdownFiles();

        for (const file of files) {
            try {
                const content = await this.app.vault.read(file);
                // 检查 frontmatter 中的 notion_id
                const match = content.match(/^---[\s\S]*?notion_id:\s*(.+?)[\s\n][\s\S]*?---/);
                if (match && match[1].trim() === notionId) {
                    return file;
                }
            } catch (e) {
                // 忽略读取错误
            }
        }
        return null;
    }

    // Perform action on the selected suggestion.
    async onChooseSuggestion(page: NotionPage, evt: MouseEvent | KeyboardEvent) {
        new Notice(`Importing ${page.title}...`);

        try {
            const markdown = await this.notionConverter.pageToMarkdown(page.id);

            // 确保 Notion_Search 文件夹存在
            const folderPath = 'Notion_Search';
            try {
                const folderExists = await this.app.vault.adapter.exists(folderPath);
                console.log(`Folder ${folderPath} exists: ${folderExists}`);
                if (!folderExists) {
                    await this.app.vault.createFolder(folderPath);
                    console.log(`Created folder: ${folderPath}`);
                }
            } catch (e) {
                console.log(`Folder may already exist or error: ${e}`);
            }

            // Create file in Obsidian
            let fileName = page.title.replace(/[\\/:*?"<>|]/g, "-") || "Untitled Notion Page";
            let filePath = `${folderPath}/${fileName}.md`;

            // Handle duplicate filenames
            let counter = 1;
            while (await this.app.vault.adapter.exists(filePath)) {
                filePath = `${folderPath}/${fileName} (${counter}).md`;
                counter++;
            }
            // 添加 YAML frontmatter
            const frontmatter = `---
notion_url: ${page.url}
notion_id: ${page.id}
---

`;
            const fileContent = frontmatter + markdown;

            // 查找是否已存在相同 notion_id 的文件
            const existingFile = await this.findFileByNotionId(page.id);

            if (existingFile) {
                // 更新已存在的文件
                await this.app.vault.modify(existingFile, fileContent);
                new Notice(`Updated ${page.title}!`);
                await this.app.workspace.openLinkText(existingFile.path, "", true);
            } else {
                // 创建新文件
                await this.app.vault.create(filePath, fileContent);
                new Notice(`Imported ${page.title}!`);
                await this.app.workspace.openLinkText(filePath, "", true);
            }

        } catch (error) {
            console.error("Error importing page:", error);
            new Notice("Failed to import page.");
        }
    }
}
