import { App, SuggestModal, Notice } from 'obsidian';
import { NotionService } from './notion';
import { NotionConverter } from './converter';

interface NotionPage {
    id: string;
    object: string; // 'page' or 'database'
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

            // Filter only pages and database and map to a simpler structure
            return results
                .filter((item: any) => item.object === 'page' || item.object === 'database')
                .map((page: any) => {
                    // Extract title safely
                    let title = "Untitled";
                    const props = page.properties;

                    if (page.object === 'database' && page.title && page.title.length > 0) {
                        title = page.title.map((t: any) => t.plain_text).join("");
                    } else {
                        for (const key in props) {
                            if (props[key].type === 'title') {
                                const titleItems = props[key].title;
                                if (titleItems && titleItems.length > 0) {
                                    title = titleItems.map((t: any) => t.plain_text).join("");
                                }
                                break;
                            }
                        }
                    }

                    return {
                        id: page.id,
                        object: page.object,
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

        // 显示图标和标题, distinguish databases
        const icon = page.icon?.emoji || (page.object === 'database' ? '🗃️' : '📄');
        container.createEl("div", {
            text: `${icon} ${page.title} ${page.object === 'database' ? '(Database)' : ''}`,
            cls: "notion-search-title"
        });

        // 显示最后编辑时间
        const editDate = new Date(page.lastEditedTime).toLocaleDateString('zh-CN');
        container.createEl("small", {
            text: `最后编辑: ${editDate}`,
            cls: "notion-search-meta"
        });
    }

    // 查找已存在的具有相同 notion_id 的文件（使用 MetadataCache 优化性能）
    private findFileByNotionId(notionId: string): import('obsidian').TFile | null {
        // 遍历所有 Markdown 文件并检查缓存的 frontmatter
        const files = this.app.vault.getMarkdownFiles();
        for (const file of files) {
            const cache = this.app.metadataCache.getFileCache(file);
            if (cache?.frontmatter && cache.frontmatter['notion_id'] === notionId) {
                return file;
            }
        }
        return null;
    }

    // Perform action on the selected suggestion.
    async onChooseSuggestion(page: NotionPage, evt: MouseEvent | KeyboardEvent) {
        if (page.object === 'database') {
            await this.importDatabase(page);
        } else {
            await this.importPage(page);
        }
    }

    async importDatabase(database: NotionPage) {
        new Notice(`Fetching pages for database ${database.title}...`);
        try {
            const basePath = await this.notionConverter.importDatabaseToFolder(database.id, database.title);
            new Notice(`Successfully imported database into /${basePath}`);
        } catch (error) {
            console.error("Error importing database:", error);
            new Notice("Failed to import database. Check console.");
        }
    }

    async importPage(page: NotionPage) {
        new Notice(`Importing ${page.title}...`);

        try {
            const markdown = await this.notionConverter.pageToMarkdown(page.id);

            // 确保 Notion_Search 文件夹存在
            const folderPath = 'Notion_Search';
            try {
                const folderExists = await this.app.vault.adapter.exists(folderPath);
                if (!folderExists) {
                    await this.app.vault.createFolder(folderPath);
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
            const now = new Date().toISOString();
            const frontmatter = `---
notion_url: ${page.url}
notion_id: ${page.id}
updated: ${now}
---

`;
            const fileContent = frontmatter + markdown;

            // 查找是否已存在相同 notion_id 的文件
            const existingFile = this.findFileByNotionId(page.id);

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
