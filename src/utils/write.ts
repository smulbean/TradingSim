// src/utils/write.ts
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export function writeJson(path: string, obj: unknown) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(obj, null, 2), "utf-8");
}
