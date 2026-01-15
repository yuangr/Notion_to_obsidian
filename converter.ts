import { NotionService, NotionBlock } from './notion';

export class NotionConverter {
    private notionService: NotionService;

    constructor(notionService: NotionService) {
        this.notionService = notionService;
    }

    async pageToMarkdown(pageId: string): Promise<string> {
        const blocks = await this.notionService.getBlocks(pageId);
        return await this.blocksToMarkdown(blocks);
    }

    private async blocksToMarkdown(blocks: NotionBlock[], indentLevel: number = 0): Promise<string> {
        const lines: string[] = [];

        for (const block of blocks) {
            const md = await this.blockToMarkdown(block);
            if (md) {
                // 只对列表项添加缩进，代码块等不缩进
                if (indentLevel > 0 && this.isListItem(block.type)) {
                    const indent = '    '.repeat(indentLevel);
                    lines.push(indent + md);
                } else {
                    lines.push(md);
                }
            }

            // 处理嵌套子块
            if (block.has_children) {
                const children = await this.notionService.getBlockChildren(block.id);
                // 只有列表项的子块增加缩进级别
                const nextIndent = this.isListItem(block.type) ? indentLevel + 1 : 0;
                const childMd = await this.blocksToMarkdown(children, nextIndent);
                if (childMd) {
                    lines.push(childMd);
                }
            }
        }

        return lines.join('\n\n');
    }

    // 判断块类型是否为列表项（需要保持层级缩进）
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
                return `> ${this.richTextToMarkdown(content?.rich_text || [])}`;

            case 'quote':
                return `> ${this.richTextToMarkdown(content?.rich_text || [])}`;

            case 'callout':
                const icon = content?.icon?.emoji || '💡';
                return `> ${icon} ${this.richTextToMarkdown(content?.rich_text || [])}`;

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
                return `![${imageName}](${imageUrl})`;

            case 'bookmark':
                const bookmarkUrl = content?.url || '';
                const bookmarkCaption = content?.caption?.length > 0
                    ? this.richTextToMarkdown(content.caption)
                    : bookmarkUrl;
                return `[${bookmarkCaption}](${bookmarkUrl})`;

            case 'link_preview':
                return `[${content?.url || ''}](${content?.url || ''})`;

            case 'equation':
                return `$$${content?.expression || ''}$$`;

            case 'table_of_contents':
                return '[[toc]]';

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

            default:
                console.log(`Unsupported block type: ${type}`);
                return '';
        }
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
            if (text.annotations.underline) {
                content = `<u>${content}</u>`;
            }

            // 处理链接
            if (text.href) {
                content = `[${content}](${text.href})`;
            }

            return content;
        }).join('');
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
