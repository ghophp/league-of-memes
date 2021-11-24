import { outputFile, pathExists, readFile } from "fs-extra";
import yaml, { Document } from "yaml";
import { platform, homedir } from "os";
import { join } from "path";

/**
 * Modifies the system.yml to enable swagger.
 * @param path {string}
 */
export async function modifySystemYaml(path: string): Promise<void> {
  if (platform() === "linux") {
    path = join(homedir(), path.slice(2, path.length));
  }
  /**
   * If File doesn't exist, do nothing.
   */
  if (!(await pathExists(path))) {
    throw new Error("system.yaml not found");
  }

  /**
   * Read and parse the yaml provided.
   */
  const file: string = await readFile(path, "utf8");
  const fileParsed: Document.Parsed = yaml.parseDocument(file);

  /**
   * Set the swagger flag to true here.
   */
  fileParsed.set("enable_swagger", true);

  const stringifiedFile: string = yaml.stringify(fileParsed);

  /**
   * Riot's file is prefixed with --- newline.
   */
  await outputFile(path, `---\n${stringifiedFile}`);
}
