import { App, requestUrl } from 'obsidian';
import { NotionService, NotionBlock } from './notion';
import { NotionImporterSettings } from './main';

export class NotionConverter {
    private notionService: NotionService;
    private app: App;
    private settings: NotionImporterSettings;

    constructor(notionService: NotionService, app: App, settings: NotionImporterSettings) {
        this.notionService = notionService;
        this.app = app;
        this.settings = settings;
    }

    async pageToMarkdown(pageId: string): Promise<string> {
        const blocks = await this.notionService.getBlocks(pageId);
        return await this.blocksToMarkdown(blocks);
    }

    private async blocksToMarkdown(blocks: NotionBlock[], indentLevel: number = 0): Promise<string> {
        const lines: string[] = [];

        for (const block of blocks) {
            let md = await this.blockToMarkdown(block);

            // 1. 对当前块应用缩进
            if (indentLevel > 0 && md) {
                const indent = '    '.repeat(indentLevel);
                md = md.split('\n').map(line => line ? indent + line : line).join('\n');
            }

            if (md) {
                lines.push(md);
            }

            // 2. 处理嵌套子块
            if (block.has_children && block.type !== 'table') {
                const children = await this.notionService.getBlockChildren(block.id);
                let childMd = '';

                if (this.isListItem(block.type)) {
                    // 列表项：子块缩进+1
                    // 注意：这里我们使用 '\n' 连接列表项以保持紧凑，或者保持原来的 '\n\n'
                    // 这里递归调用会产生带缩进的块字符串
                    childMd = await this.blocksToMarkdown(children, indentLevel + 1);
                } else if (['quote', 'callout', 'toggle'].includes(block.type)) {
                    // 容器块：子块作为引用内容
                    // 先生成不带缩进的内容
                    const innerMd = await this.blocksToMarkdown(children, 0);
                    // 给每一行添加 '> '
                    const quoteContent = innerMd.split('\n').map(l => l ? `> ${l}` : '>').join('\n');

                    // 如果容器本身有缩进（比如在列表中），则内容也需要缩进
                    if (indentLevel > 0) {
                        const indent = '    '.repeat(indentLevel);
                        childMd = quoteContent.split('\n').map(l => l ? indent + l : l).join('\n');
                    } else {
                        childMd = quoteContent;
                    }
                } else {
                    // 其他透明容器（如 Synced Block, Column），传递当前缩进
                    childMd = await this.blocksToMarkdown(children, indentLevel);
                }

                if (childMd) {
                    lines.push(childMd);
                }
            }
        }

        // 使用 \n 连接块，如果是松散模式可以用 \n\n，这里为了紧凑列表尝试 \n
        // 但为了段落间距，保险起见先维持 \n\n，除非全是列表项
        return lines.join('\n\n');
    }

    // 判断块类型是否为列表项
    private isListItem(type: string): boolean {
        return ['bulleted_list_item', 'numbered_list_item', 'to_do'].includes(type);
    }




    private async blockToMarkdown(block: NotionBlock): Promise<string> {
        const type = block.type;
        const content = block[type];

        switch (type) {
            case 'paragraph':
                return this.richTextToMarkdown(content?.rich_text || []);

            case 'heading_1':
                return `# ${this.richTextToMarkdown(content?.rich_text || [])}`;

            case 'heading_2':
                return `## ${this.richTextToMarkdown(content?.rich_text || [])}`;

            case 'heading_3':
                return `### ${this.richTextToMarkdown(content?.rich_text || [])}`;

            case 'bulleted_list_item':
                return `- ${this.richTextToMarkdown(content?.rich_text || [])}`;

            case 'numbered_list_item':
                return `1. ${this.richTextToMarkdown(content?.rich_text || [])}`;

            case 'to_do':
                const checked = content?.checked ? 'x' : ' ';
                return `- [${checked}] ${this.richTextToMarkdown(content?.rich_text || [])}`;

            case 'toggle':
                // Obsidian 可折叠块使用 callout 语法 > [!info]-
                const toggleText = this.richTextToMarkdown(content?.rich_text || []);
                return `> [!info]- ${toggleText}`;

            case 'quote':
                // Obsidian 引用块
                const quoteText = this.richTextToMarkdown(content?.rich_text || []);
                return quoteText.split('\n').map(line => `> ${line}`).join('\n');

            case 'callout':
                // Obsidian Callout 格式: > [!type]
                const calloutIcon = content?.icon?.emoji || '';
                const calloutText = this.richTextToMarkdown(content?.rich_text || []);
                const calloutType = this.mapCalloutType(calloutIcon);
                return `> [!${calloutType}]\n> ${calloutText}`;

            case 'code':
                const language = content?.language || '';
                const code = this.richTextToMarkdown(content?.rich_text || []);
                return `\`\`\`${language}\n${code}\n\`\`\``;

            case 'divider':
                return '---';

            case 'image':
                const imageUrl = content?.file?.url || content?.external?.url || '';
                // 使用 ![name](url) 格式以便在 Obsidian 中预览
                const imageName = content?.caption?.length > 0
                    ? this.richTextToMarkdown(content.caption)
                    : this.extractFileName(imageUrl) || '图片';

                if (this.settings.downloadImages && imageUrl) {
                    try {
                        const response = await requestUrl({ url: imageUrl });
                        const arrayBuffer = response.arrayBuffer;

                        let ext = imageUrl.split('.').pop()?.split('?')[0] || 'png';
                        if (ext.length > 5 || !/^[a-zA-Z0-9]+$/.test(ext)) {
                            ext = 'png';
                        }

                        const safeName = imageName.replace(/[\\/:*?"<>|]/g, "_");
                        let folderName = this.settings.imageFolderPath || '';

                        if (folderName && !await this.app.vault.adapter.exists(folderName)) {
                            await this.app.vault.createFolder(folderName);
                        }

                        let baseFilePath = folderName ? `${folderName}/${safeName}.${ext}` : `${safeName}.${ext}`;
                        let filePath = baseFilePath;

                        let counter = 1;
                        while (await this.app.vault.adapter.exists(filePath)) {
                            filePath = folderName
                                ? `${folderName}/${safeName}_${counter}.${ext}`
                                : `${safeName}_${counter}.${ext}`;
                            counter++;
                        }

                        await this.app.vault.createBinary(filePath, arrayBuffer);

                        return `![[${filePath.split('/').pop()}]]`;
                    } catch (e) {
                        console.error("Failed to download image", e);
                        return `![${imageName}](${imageUrl})`;
                    }
                }

                return `![${imageName}](${imageUrl})`;

            case 'table':
                const tableChildren = await this.notionService.getBlockChildren(block.id);
                let tableMd = '';

                for (let i = 0; i < tableChildren.length; i++) {
                    const row = tableChildren[i];
                    if (row.type === 'table_row') {
                        const cells = row.table_row?.cells || [];
                        const rowText = cells.map((cell: any[]) => this.richTextToMarkdown(cell).replace(/\|/g, '\\|')).join(' | ');
                        tableMd += `| ${rowText} |\n`;

                        if (i === 0) {
                            // Markdown requires a separator after the first row
                            const separator = Array(Math.max(cells.length, 1)).fill('---').join(' | ');
                            tableMd += `| ${separator} |\n`;
                        }
                    }
                }
                return tableMd.trim();

            case 'bookmark':
                const bookmarkUrl = content?.url || '';
                const bookmarkCaption = content?.caption?.length > 0
                    ? this.richTextToMarkdown(content.caption)
                    : bookmarkUrl;
                return `[${bookmarkCaption}](${bookmarkUrl})`;

            case 'link_preview':
                return `[${content?.url || ''}](${content?.url || ''})`;

            case 'equation':
                // Obsidian 块级数学公式
                return `$$\n${content?.expression || ''}\n$$`;

            case 'table_of_contents':
                // Obsidian 不支持自动目录，返回空或可选择使用插件
                return '';

            case 'child_page':
                return `📄 [[${content?.title || 'Untitled'}]]`;

            case 'child_database':
                return `📊 [[${content?.title || 'Untitled Database'}]]`;

            case 'embed':
            case 'video':
            case 'file':
            case 'pdf':
                const fileUrl = content?.file?.url || content?.external?.url || content?.url || '';
                const fileName = content?.name || this.extractFileName(fileUrl) || '文件';
                return `[${fileName}](${fileUrl})`;

            case 'column_list':
            case 'column':
            case 'synced_block':
                // 这些是布局或容器块，本身不产生 Markdown，但需要处理其子块 (由 blocksToMarkdown 递归处理)
                return '';

            default:
                console.log(`Unsupported block type: ${type}`);
                return '';
        }
    }

    public propertiesToYAML(properties: Record<string, any>): string {
        if (!properties) return '';

        let yaml = '---\n';
        for (const [key, prop] of Object.entries(properties)) {
            let value = '';

            switch (prop.type) {
                case 'title':
                    value = prop.title.map((t: any) => t.plain_text).join('');
                    break;
                case 'rich_text':
                    value = prop.rich_text.map((t: any) => t.plain_text).join('');
                    break;
                case 'number':
                    value = prop.number !== null ? prop.number.toString() : '';
                    break;
                case 'select':
                    value = prop.select ? prop.select.name : '';
                    break;
                case 'multi_select':
                    value = prop.multi_select ? `[${prop.multi_select.map((s: any) => `"${s.name}"`).join(', ')}]` : '[]';
                    break;
                case 'date':
                    if (prop.date) {
                        value = prop.date.start;
                        if (prop.date.end) {
                            value += ` to ${prop.date.end}`;
                        }
                    }
                    break;
                case 'checkbox':
                    value = prop.checkbox ? 'true' : 'false';
                    break;
                case 'url':
                    value = prop.url || '';
                    break;
                case 'email':
                    value = prop.email || '';
                    break;
                case 'phone_number':
                    value = prop.phone_number || '';
                    break;
                case 'status':
                    value = prop.status ? prop.status.name : '';
                    break;
                // Add more property types as needed (people, files, relation, formula, rollup, etc. are complex)
            }

            if (value !== '') {
                // To avoid breaking yaml with special characters, simple wrapping might be needed depending on value type
                if (prop.type === 'multi_select' || prop.type === 'checkbox' || prop.type === 'number') {
                    yaml += `${key}: ${value}\n`;
                } else {
                    // Escape quotes for string values
                    const safeValue = value.replace(/"/g, '\\"');
                    yaml += `${key}: "${safeValue}"\n`;
                }
            }
        }
        yaml += '---';
        return yaml;
    }

    private richTextToMarkdown(richText: any[]): string {
        if (!richText || richText.length === 0) {
            return '';
        }

        return richText.map(text => {
            let content = text.plain_text || '';

            if (!text.annotations) {
                return content;
            }

            // 应用格式
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
            // Obsidian 不原生支持下划线，但支持 HTML
            if (text.annotations.underline) {
                content = `<u>${content}</u>`;
            }
            // Obsidian 高亮文本使用 ==text== 语法
            if (text.annotations.color && text.annotations.color.includes('background')) {
                content = `==${content}==`;
            }

            // 处理链接
            if (text.href) {
                content = `[${content}](${text.href})`;
            }

            return content;
        }).join('');
    }

    // 将 Notion 图标映射到 Obsidian Callout 类型
    private mapCalloutType(icon: string): string {
        const iconMap: Record<string, string> = {
            '💡': 'tip',
            '⚠️': 'warning',
            '❗': 'important',
            '📝': 'note',
            '✅': 'success',
            '❌': 'failure',
            '🔥': 'danger',
            '❓': 'question',
            '💬': 'quote',
            '📌': 'abstract',
            '🐛': 'bug',
            '📖': 'example',
            '🔗': 'info',
        };
        return iconMap[icon] || 'note';
    }

    // 从 URL 中提取文件名
    private extractFileName(url: string): string {
        try {
            const urlObj = new URL(url);
            const pathname = urlObj.pathname;
            const fileName = pathname.split('/').pop() || '';
            // 解码 URL 编码的文件名，并去除查询参数
            return decodeURIComponent(fileName.split('?')[0]);
        } catch {
            return '';
        }
    }
}
