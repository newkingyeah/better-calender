# better-calender

View, open, and create daily notes from a month calendar in Obsidian's right sidebar. A dot appears under each date with a note, and today's date uses your theme's accent color.

Click a date to open its note. An empty date creates the note and any missing folders. New notes use the template configured in the core Daily Notes plugin when available.

In **Settings → better-calender**, enter a vault-relative folder under **日记目录** and a date format under **日期路径格式**. For example, the folder `Journal` and format `YYYY/M/YYYY-MM-DD [review]` resolve November 24, 2026 to `Journal/2026/11/2026-11-24 review.md`.

## 中文

Obsidian 右侧栏月历。有日记的日期显示一点。点击日期打开日记，空白日期会先按设置创建对应的笔记和目录。今天的数字使用主题强调色。

新建日记时会使用核心「日记」配置的模板（如有）。

在「better-calender」设置中填入相对于仓库根目录的日记目录和日期路径格式。例如目录为 `日记`，格式为 `YYYY/M/YYYY-MM-DD [review]` 时，2026 年 11 月 24 日对应 `日记/2026/11/2026-11-24 review.md`。首次启用时会尝试使用核心「日记」的设置。

首次启用会在右侧栏打开月历。命令面板里的「better-calender：打开右侧日历」可以重新打开。

## Build and install

Run `npm ci` and `npm run build`. Copy `main.js`, `manifest.json`, and `styles.css` into your vault's `.obsidian/plugins/better-calender` folder. Enable **better-calender** in Community plugins.

## License

MIT. See [LICENSE](LICENSE).
