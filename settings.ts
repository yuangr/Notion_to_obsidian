import { App, PluginSettingTab, Setting } from 'obsidian';
import NotionImporterPlugin from './main';

export class NotionImporterSettingTab extends PluginSettingTab {
    plugin: NotionImporterPlugin;

    constructor(app: App, plugin: NotionImporterPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;

        containerEl.empty();

        containerEl.createEl('h2', { text: 'Notion Importer Settings' });

        new Setting(containerEl)
            .setName('Notion Integration Token')
            .setDesc('Enter your Notion Integration Token (start with secret_)')
            .addText(text => text
                .setPlaceholder('secret_...')
                .setValue(this.plugin.settings.notionToken)
                .onChange(async (value) => {
                    this.plugin.settings.notionToken = value;
                    await this.plugin.saveSettings();
                    this.plugin.initializeServices();
                }));
    }
}
