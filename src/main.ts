import { ItemView, Notice, Plugin, MarkdownView, setIcon, type TAbstractFile, type WorkspaceLeaf } from "obsidian";
import { dateKey, dateLabel, isoWeek, monthStart, monthWeeks, sameMonth } from "./dates";
import { findOrCreateJournal } from "./journals";
import { CalendarSettingsTab, journalPath, loadCalendarSettings, type CalendarSettings } from "./settings";

const VIEW_TYPE = "better-calender-view";
const NAME = "better-calender";
const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

export default class JournalCalendarPlugin extends Plugin {
  settings!: CalendarSettings;
  private refreshTimer: number | undefined;
  private disposed = false;
  private readonly opening = new Set<string>();

  async onload(): Promise<void> {
    const { vault, workspace } = this.app;
    this.settings = await loadCalendarSettings(vault, await this.loadData());
    this.registerView(VIEW_TYPE, leaf => new CalendarView(leaf, this));
    this.addSettingTab(new CalendarSettingsTab(this.app, this));
    this.addCommand({ id: "open", name: "打开右侧日历", callback: () => { void this.openCalendar(); } });

    workspace.onLayoutReady(() => {
      if (this.disposed) return;
      this.registerEvent(vault.on("create", file => this.scheduleRefresh(file)));
      this.registerEvent(vault.on("delete", file => this.scheduleRefresh(file)));
      this.registerEvent(vault.on("rename", (file, oldPath) => this.scheduleRefresh(file, oldPath)));
      if (workspace.getLeavesOfType(VIEW_TYPE).length === 0) void this.openCalendar();
    });
  }

  onunload(): void {
    this.disposed = true;
    window.clearTimeout(this.refreshTimer);
  }

  async updateSettings(settings: CalendarSettings): Promise<void> {
    await this.saveData(settings);
    this.settings = settings;
    this.refreshViews();
  }

  async openJournal(path: string, day: Date): Promise<void> {
    if (this.opening.has(path)) return;
    this.opening.add(path);
    const { vault, workspace } = this.app;
    try {
      const file = await findOrCreateJournal(vault, path, day);
      if (this.disposed) return;
      const open = workspace.getLeavesOfType("markdown").find(leaf =>
        leaf.view instanceof MarkdownView && leaf.view.file === file,
      );
      if (open) {
        await workspace.revealLeaf(open);
        return;
      }
      const recent = workspace.getMostRecentLeaf(workspace.rootSplit);
      const type = recent?.getViewState().type;
      const leaf = recent && (type === "markdown" || type === "empty") ? recent : workspace.getLeaf("tab");
      await leaf.openFile(file);
      await workspace.revealLeaf(leaf);
    } catch (error) {
      console.error("[better-calender] 日记创建或打开失败", error);
      new Notice("日记创建或打开失败，请检查日记路径。");
    } finally {
      this.opening.delete(path);
    }
  }

  private async openCalendar(): Promise<void> {
    try {
      await this.app.workspace.ensureSideLeaf(VIEW_TYPE, "right", { active: false });
    } catch (error) {
      console.error("[better-calender] 无法打开侧栏", error);
      new Notice("无法打开日记日历。");
    }
  }

  private scheduleRefresh(file: TAbstractFile, oldPath?: string): void {
    const directory = this.settings.folder;
    const touchesDirectory = (path: string) => !directory || path === directory
      || path.startsWith(directory + "/") || directory.startsWith(path + "/");
    if (!touchesDirectory(file.path) && !(oldPath && touchesDirectory(oldPath))) return;
    window.clearTimeout(this.refreshTimer);
    this.refreshTimer = window.setTimeout(() => this.refreshViews(), 70);
  }

  private refreshViews(): void {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
      if (leaf.view instanceof CalendarView) leaf.view.render();
    }
  }
}

class CalendarView extends ItemView {
  private today = new Date();
  private month = monthStart(this.today);
  private monthText?: HTMLElement;
  private yearText?: HTMLElement;
  private tableBody?: HTMLTableSectionElement;
  private midnightTimer: number | undefined;

  constructor(leaf: WorkspaceLeaf, private readonly calendar: JournalCalendarPlugin) {
    super(leaf);
  }

  getViewType(): string { return VIEW_TYPE; }
  getDisplayText(): string { return NAME; }
  getIcon(): string { return "calendar-days"; }

  async onOpen(): Promise<void> {
    this.contentEl.empty();
    this.contentEl.addClass("jc-content");
    const root = this.contentEl.createEl("section", { cls: "jc-calendar", attr: { "aria-label": NAME } });
    const top = root.createDiv({ cls: "jc-top" });
    const heading = top.createEl("h2", {
      cls: "jc-heading",
      attr: { "aria-live": "polite", "aria-atomic": "true" },
    });
    this.monthText = heading.createSpan({ cls: "jc-month" });
    this.yearText = heading.createSpan({ cls: "jc-year" });

    const nav = top.createEl("nav", { cls: "jc-nav", attr: { "aria-label": "月份导航" } });
    this.navButton(nav, "上个月", "chevron-left", () => this.moveMonth(-1));
    this.navButton(nav, "今天", null, () => {
      this.today = new Date();
      this.month = monthStart(this.today);
      this.render();
      this.scheduleMidnight();
    });
    this.navButton(nav, "下个月", "chevron-right", () => this.moveMonth(1));

    const table = root.createEl("table", { cls: "jc-grid", attr: { "aria-label": "月历" } });
    const header = table.createEl("thead").createEl("tr");
    header.createEl("th", { text: "W", cls: "jc-week", attr: { scope: "col", "aria-label": "周次" } });
    for (const day of WEEKDAYS) header.createEl("th", { text: "周" + day, attr: { scope: "col" } });
    this.tableBody = table.createEl("tbody");

    this.registerDomEvent(this.contentEl.ownerDocument.defaultView ?? window, "focus", () => this.updateToday());
    this.updateToday();
    this.render();
  }

  async onClose(): Promise<void> {
    window.clearTimeout(this.midnightTimer);
    this.tableBody = undefined;
    this.contentEl.empty();
  }

  render(): void {
    const body = this.tableBody;
    if (!body || !this.monthText || !this.yearText) return;
    this.monthText.setText(`${this.month.getMonth() + 1}月`);
    this.yearText.setText(String(this.month.getFullYear()));
    const focused = body.ownerDocument.activeElement;
    const focusedDate = focused && body.contains(focused) ? focused.getAttribute("data-date") : null;
    const current = dateKey(this.today);
    body.empty();

    for (const days of monthWeeks(this.month)) {
      const row = body.createEl("tr");
      row.createEl("th", { text: String(isoWeek(days[0])), cls: "jc-week", attr: { scope: "row" } });
      for (const day of days) {
        const key = dateKey(day);
        const path = journalPath(this.calendar.settings, day);
        const file = path ? this.app.vault.getFileByPath(path) : null;
        const cell = row.createEl("td");
        const date = cell.createEl(path ? "button" : "span", {
          cls: "jc-date",
          attr: { "data-date": key, "aria-label": dateLabel(day) + (file ? "，打开日记" : path ? "，创建日记" : "") },
        });
        date.toggleClass("is-adjacent", !sameMonth(this.month, day));
        if (key === current) {
          date.addClass("is-today");
          date.setAttribute("aria-current", "date");
        }
        date.createSpan({ cls: "jc-day-number", text: String(day.getDate()) });
        if (path) {
          date.setAttribute("type", "button");
          date.addEventListener("click", () => { void this.calendar.openJournal(path, day); });
        }
        if (file) date.createSpan({ cls: "jc-dot", attr: { "aria-hidden": "true" } });
        if (key === focusedDate && path) date.focus({ preventScroll: true });
      }
    }
  }

  private navButton(parent: HTMLElement, label: string, icon: string | null, action: () => void): void {
    const button = parent.createEl("button", {
      cls: icon ? "jc-arrow" : "jc-today",
      attr: { type: "button", "aria-label": label, title: label },
    });
    if (icon) setIcon(button, icon);
    else button.setText(label);
    button.addEventListener("click", action);
  }

  private moveMonth(direction: number): void {
    this.month = monthStart(this.month, direction);
    this.render();
  }

  private updateToday(): void {
    const now = new Date();
    if (dateKey(now) !== dateKey(this.today)) {
      if (sameMonth(this.today, this.month)) this.month = monthStart(now);
      this.today = now;
      this.render();
    }
    this.scheduleMidnight();
  }

  private scheduleMidnight(): void {
    window.clearTimeout(this.midnightTimer);
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    this.midnightTimer = window.setTimeout(() => this.updateToday(), tomorrow.getTime() - now.getTime() + 100);
  }
}
