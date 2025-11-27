// src/buildIndex.ts
import fs from "fs";
import path from "path";
import { chunkText } from "./chunkText";
import { getEmbedding } from "./embeddings";
import { loadDocuments } from "./loadDocs";

/**
 * Тип элемента индекса
 */
export interface IndexItem {
  id: string;
  source: string;
  chunk: string;
  embedding: number[];
}

async function buildIndex() {
  console.log("Загрузка документов из папки docs/...");
  const docs = loadDocuments();

  const allIndexItems: IndexItem[] = [];

  for (const doc of docs) {
    console.log(`\nДокумент: ${doc.id}`);
    console.log("Разбивка на чанки...");

    const chunks = chunkText(doc.text, doc.id, 400, 100);
    console.log(`Получено чанков: ${chunks.length}`);

    for (const chunk of chunks) {
      console.log(` → embedding для ${chunk.id}...`);

      const embedding = await getEmbedding(chunk.text);

      allIndexItems.push({
        id: chunk.id,
        source: chunk.source,
        chunk: chunk.text,
        embedding,
      });
    }
  }

  // сохраняем
  const outputPath = path.resolve("data/index.json");
  fs.writeFileSync(outputPath, JSON.stringify(allIndexItems, null, 2), "utf-8");

  console.log(`\nГотово! Индекс сохранён в ${outputPath}`);
  console.log(`Всего элементов: ${allIndexItems.length}`);
}

buildIndex().catch((err) => {
  console.error("Ошибка во время создания индекса:", err);
  process.exit(1);
});
