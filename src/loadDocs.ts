// src/loadDocs.ts
import fs from "fs";
import path from "path";

export interface LoadedDocument {
  id: string; // например "example1.txt"
  filePath: string; // полный путь: docs/example1.txt
  text: string; // plain text
}

/**
 * Простой лоадер документов из папки docs/
 * Поддерживает txt / md (PDF можно добавить позже)
 */
export function loadDocuments(docsDir = "docs"): LoadedDocument[] {
  const docs: LoadedDocument[] = [];

  const absoluteDocsDir = path.resolve(docsDir);
  const files = fs.readdirSync(absoluteDocsDir);

  for (const fileName of files) {
    const ext = path.extname(fileName).toLowerCase();
    const fullPath = path.join(absoluteDocsDir, fileName);

    if (ext === ".txt" || ext === ".md") {
      const raw = fs.readFileSync(fullPath, "utf-8");

      docs.push({
        id: fileName,
        filePath: fullPath,
        text: raw,
      });
    } else if (ext === ".pdf") {
      // не делаем — оставим как TODO
      console.warn(
        `PDF пока не поддержан: ${fileName} (TODO: добавить парсер)`
      );
    } else {
      console.warn(`Пропускаем неподдерживаемый файл: ${fileName}`);
    }
  }

  return docs;
}
