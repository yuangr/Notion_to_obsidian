import { Plugin, Notice } from 'obsidian';
import { NotionImporterSettingTab } from './settings';
import { NotionService } from './notion';
import { NotionConverter } from './converter';
import { NotionSearchModal } from './search_modal';

interface NotionImporterSettings {
    notionToken: string;
}

const DEFAULT_SETTINGS: NotionImporterSettings = {
    notionToken: ''
}

export default class NotionImporterPlugin extends Plugin {
    settings: NotionImporterSettings;
    notionService: NotionService;
    notionConverter: NotionConverter;

    async onload() {
        await this.loadSettings();

        console.log('Notion Importer Plugin loaded');

        // Initialize services
        this.initializeServices();

        // This creates an icon in the left ribbon.
        const ribbonIconEl = this.addRibbonIcon('dice', 'Import from Notion', (evt: MouseEvent) => {
            this.openSearchModal();
        });
        // Perform additional things with the ribbon
        ribbonIconEl.addClass('my-plugin-ribbon-class');

        // This adds a simple command that can be triggered anywhere
        this.addCommand({
            id: 'import-from-notion',
            name: 'Import from Notion',
            callback: () => {
                this.openSearchModal();
            }
        });

        // This adds a settings tab so the user can configure various aspects of the plugin
        this.addSettingTab(new NotionImporterSettingTab(this.app, this));
    }

    initializeServices() {
        if (this.settings.notionToken) {
            this.notionService = new NotionService(this.settings.notionToken);
            this.notionConverter = new NotionConverter(this.notionService);
        }
    }

    openSearchModal() {
        if (!this.settings.notionToken) {
            new Notice("Please configure your Notion Integration Token in settings first.");
            return;
        }

        if (!this.notionService) {
            this.initializeServices();
        }

        if (!this.notionService) {
            new Notice("Failed to initialize Notion service. Check your token.");
            return;
        }

        new NotionSearchModal(this.app, this.notionService, this.notionConverter).open();
    }

    async onunload() {

    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}
