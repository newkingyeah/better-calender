import { moment, normalizePath, type TFile, type Vault } from "obsidian";
import { readDailyNotesConfig } from "./settings";

export async function findOrCreateJournal(vault: Vault, path: string, day: Date): Promise<TFile> {
  const existing = vault.getFileByPath(path);
  if (existing) return existing;

  const content = await noteContent(vault, path, day);
  let directory = "";
  for (const segment of path.split("/").slice(0, -1)) {
    directory = directory ? `${directory}/${segment}` : segment;
    if (vault.getFolderByPath(directory)) continue;
    try {
      await vault.createFolder(directory);
    } catch (error) {
      if (!vault.getFolderByPath(directory)) throw error;
    }
  }

  try {
    return vault.getFileByPath(path) ?? await vault.create(path, content);
  } catch (error) {
    const createdElsewhere = vault.getFileByPath(path);
    if (createdElsewhere) return createdElsewhere;
    throw error;
  }
}

async function noteContent(vault: Vault, path: string, day: Date): Promise<string> {
  const config = await readDailyNotesConfig(vault).catch(() => null);
  if (typeof config?.template !== "string" || !config.template.trim()) return "";
  const templatePath = normalizePath(config.template.trim());
  const template = vault.getFileByPath(templatePath) ?? vault.getFileByPath(templatePath + ".md");
  if (!template) return "";

  const templateText = await vault.cachedRead(template);
  const title = path.slice(path.lastIndexOf("/") + 1).replace(/\.md$/i, "");
  const date = moment(day);
  const time = moment();
  return templateText.replace(/\{\{\s*(title|date|time)\s*(?::\s*([^}]+?)\s*)?\}\}/g,
    (_token, name: string, format: string | undefined) => {
      if (name === "title") return title;
      if (name === "date") return date.format(format || "YYYY-MM-DD");
      return time.format(format || "HH:mm");
    });
}
