import { moment, normalizePath, PluginSettingTab, Setting, type App, type Vault } from "obsidian";
import { localDate } from "./dates";
import type JournalCalendarPlugin from "./main";

export interface CalendarSettings {
  folder: string;
  dateFormat: string;
}

const DEFAULTS: CalendarSettings = { folder: "", dateFormat: "YYYY-MM-DD" };

export async function readDailyNotesConfig(vault: Vault): Promise<{ folder?: unknown; format?: unknown; template?: unknown } | null> {
  return JSON.parse(await vault.adapter.read(`${vault.configDir}/daily-notes.json`));
}

function isRelativePath(path: string): boolean {
  return path.split("/").every(part =>
    part !== "" && part !== "." && part !== ".." && !/[<>:"|?*\\\x00-\x1f]/.test(part),
  );
}

export function journalPath(settings: CalendarSettings, date: Date): string | null {
  const formatted = moment(date).format(settings.dateFormat);
  if (!isRelativePath(formatted)) return null;
  const filename = /\.md$/i.test(formatted) ? formatted : formatted + ".md";
  return normalizePath(settings.folder ? `${settings.folder}/${filename}` : filename);
}

function validate(folder: string, dateFormat: string): CalendarSettings {
  folder = folder.trim().replace(/\\/g, "/").replace(/\/+$/, "");
  if (folder && !isRelativePath(folder)) {
    throw new Error("请输入仓库内的相对目录。");
  }
  const settings = { folder, dateFormat: dateFormat.trim() };
  if (!settings.dateFormat) throw new Error("请输入日期路径格式。");
  const examples = [
    localDate(2026, 0, 9), localDate(2026, 0, 10), localDate(2026, 1, 9), localDate(2027, 0, 9),
  ].map(date => journalPath(settings, date));
  if (examples.includes(null) || new Set(examples).size !== examples.length) {
    throw new Error("日期格式需要生成能区分不同日期的文件路径。");
  }
  return settings;
}

function readSettingStrings(data: unknown): Partial<CalendarSettings> {
  if (!data || typeof data !== "object") return {};
  const stored = data as Record<string, unknown>;
  return {
    folder: typeof stored.folder === "string" ? stored.folder : undefined,
    dateFormat: typeof stored.dateFormat === "string" ? stored.dateFormat : undefined,
  };
}

export async function loadCalendarSettings(vault: Vault, stored: unknown): Promise<CalendarSettings> {
  const values = readSettingStrings(stored);
  if (values.folder !== undefined || values.dateFormat !== undefined) {
    try {
      return validate(values.folder ?? DEFAULTS.folder, values.dateFormat ?? DEFAULTS.dateFormat);
    } catch {
      // A damaged setting can be replaced from the settings tab.
    }
  }

  try {
    const core = await readDailyNotesConfig(vault);
    const folder = typeof core?.folder === "string" ? core.folder.trim().replace(/\\/g, "/").replace(/\/+$/, "") : "";
    const format = typeof core?.format === "string" && core.format.trim() ? core.format : DEFAULTS.dateFormat;
    const monthFolder = /^(?:(.+)\/)?(\d{4})\/(0?[1-9]|1[0-2])$/.exec(folder);
    if (!monthFolder || format.includes("/")) return validate(folder, format);

    // A fixed year/month in Daily Notes becomes a date-relative directory here.
    const [, base = "", year, month] = monthFolder;
    const parent = base ? `${base}/${year}` : year;
    const list = await vault.adapter.list(parent).catch(() => ({ folders: [] }));
    const monthNames = list.folders.map(path => path.split("/").pop() ?? "");
    const padded = month.startsWith("0")
      || (!monthNames.some(name => /^[1-9]$/.test(name)) && monthNames.some(name => /^0[1-9]$/.test(name)));
    return validate(base, `YYYY/${padded ? "MM" : "M"}/${format}`);
  } catch {
    return { ...DEFAULTS };
  }
}

export class CalendarSettingsTab extends PluginSettingTab {
  constructor(app: App, private readonly calendar: JournalCalendarPlugin) {
    super(app, calendar);
  }

  display(): void {
    this.containerEl.empty();
    let { folder, dateFormat } = this.calendar.settings;

    new Setting(this.containerEl)
      .setName("日记目录")
      .setDesc("相对于仓库根目录，留空使用根目录。")
      .addText(text => text
        .setPlaceholder("日记")
        .setValue(folder)
        .onChange(value => { folder = value; updateExample(); }));

    new Setting(this.containerEl)
      .setName("日期路径格式")
      .setDesc("例如 YYYY/M/YYYY-MM-DD [review]，支持按年和月分目录。")
      .addText(text => text
        .setPlaceholder("YYYY-MM-DD")
        .setValue(dateFormat)
        .onChange(value => { dateFormat = value; updateExample(); }));

    const example = new Setting(this.containerEl).setName("今日文件路径");
    const status = this.containerEl.createDiv({
      cls: "jc-setting-status",
      attr: { role: "status" },
    });
    const updateExample = () => {
      try {
        const value = validate(folder, dateFormat);
        example.setDesc(journalPath(value, new Date()) ?? "—");
      } catch {
        example.setDesc("—");
      }
    };
    updateExample();

    new Setting(this.containerEl).addButton(button => button
      .setButtonText("保存")
      .setCta()
      .onClick(async () => {
        button.setDisabled(true);
        try {
          await this.calendar.updateSettings(validate(folder, dateFormat));
          status.setText("已保存");
        } catch (error) {
          status.setText(error instanceof Error ? error.message : "无法保存日记设置。");
        } finally {
          button.setDisabled(false);
        }
      }));
  }
}
