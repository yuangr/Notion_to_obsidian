import { requestUrl, RequestUrlParam } from 'obsidian';

const NOTION_API_BASE = 'https://api.notion.com/v1';
const NOTION_VERSION = '2025-09-03';

export interface NotionPage {
    id: string;
    object: string;
    properties: Record<string, any>;
    url: string;
    icon: any;
    parent: any;
    created_time: string;
    last_edited_time: string;
}

export interface NotionSearchResponse {
    results: NotionPage[];
    next_cursor: string | null;
    has_more: boolean;
}

export interface NotionBlock {
    id: string;
    type: string;
    [key: string]: any;
}

export class NotionService {
    private token: string;

    constructor(token: string) {
        this.token = token;
    }

    // 使用 Obsidian 的 requestUrl 避免 CORS 问题
    private async request(endpoint: string, options: Partial<RequestUrlParam> = {}): Promise<any> {
        const url = `${NOTION_API_BASE}${endpoint}`;

        const requestOptions: RequestUrlParam = {
            url: url,
            method: options.method || 'GET',
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Notion-Version': NOTION_VERSION,
                'Content-Type': 'application/json',
                ...options.headers,
            },
            body: options.body,
        };

        try {
            const response = await requestUrl(requestOptions);
            return response.json;
        } catch (error) {
            console.error(`Notion API error [${endpoint}]:`, error);
            throw error;
        }
    }

    async search(query: string): Promise<NotionPage[]> {
        const body = JSON.stringify({
            query: query,
            sort: {
                direction: 'descending',
                timestamp: 'last_edited_time'
            },
            page_size: 20,
        });

        const response = await this.request('/search', {
            method: 'POST',
            body: body,
        }) as NotionSearchResponse;

        return response.results;
    }

    async getPage(pageId: string): Promise<NotionPage> {
        return await this.request(`/pages/${pageId}`);
    }

    async getBlocks(blockId: string): Promise<NotionBlock[]> {
        const blocks: NotionBlock[] = [];
        let cursor: string | undefined = undefined;

        do {
            const endpoint = cursor
                ? `/blocks/${blockId}/children?start_cursor=${cursor}`
                : `/blocks/${blockId}/children`;

            const response = await this.request(endpoint);
            blocks.push(...response.results);
            cursor = response.has_more ? response.next_cursor : undefined;
        } while (cursor);

        return blocks;
    }

    async getBlockChildren(blockId: string): Promise<NotionBlock[]> {
        return await this.getBlocks(blockId);
    }

    async getDatabase(databaseId: string): Promise<any> {
        return await this.request(`/databases/${databaseId}`);
    }

    async getDatabasePages(databaseId: string): Promise<NotionPage[]> {
        // Step 1: Retrieve the database to get data_source_id
        // Notion API v2025-09-03 deprecated /databases/{id}/query
        // and requires /data_sources/{data_source_id}/query instead
        const database = await this.getDatabase(databaseId);

        let dataSourceId: string | undefined;
        if (database.data_sources && database.data_sources.length > 0) {
            dataSourceId = database.data_sources[0].id;
        }

        if (!dataSourceId) {
            console.error('No data_source_id found for database:', databaseId, 'Full response:', JSON.stringify(database));
            throw new Error(`No data_source_id found for database ${databaseId}. Make sure the database is shared with your Notion integration.`);
        }

        console.log(`Database ${databaseId} -> data_source_id: ${dataSourceId}`);

        // Step 2: Query the data source
        const pages: NotionPage[] = [];
        let cursor: string | undefined = undefined;

        do {
            const body: any = {
                page_size: 100,
            };
            if (cursor) {
                body.start_cursor = cursor;
            }

            const response = await this.request(`/data_sources/${dataSourceId}/query`, {
                method: 'POST',
                body: JSON.stringify(body)
            });

            pages.push(...response.results);
            cursor = response.has_more ? response.next_cursor : undefined;
        } while (cursor);

        return pages;
    }
}
