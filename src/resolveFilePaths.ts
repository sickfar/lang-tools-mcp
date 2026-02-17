import * as path from "path";
import * as fs from "fs";

/**
 * Resolve an array of file/directory paths into individual file paths.
 * Directories are recursively scanned for files matching the given extension.
 */
export interface ResolveError {
  path: string;
  message: string;
}

export function resolveFilePaths(paths: string[], extension: string): { resolved: string[], errors: ResolveError[] } {
  const resolved: string[] = [];
  const errors: ResolveError[] = [];

  for (const p of paths) {
    const absolutePath = path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);

    if (!fs.existsSync(absolutePath)) {
      errors.push({ path: p, message: `Path not found: ${p}` });
      continue;
    }

    const stat = fs.statSync(absolutePath);
    if (stat.isDirectory()) {
      const entries = fs.readdirSync(absolutePath, { recursive: true, withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith(extension)) {
          resolved.push(path.join(entry.parentPath ?? entry.path, entry.name));
        }
      }
    } else {
      resolved.push(absolutePath);
    }
  }

  return { resolved, errors };
}
