// src/search.ts
import fs from "fs";
import path from "path";
import type { IndexItem } from "./buildIndex";
import { getEmbedding } from "./embeddings";

/**
 * Косинусное сходство между двумя embedding-векторами
 */
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Главная функция поиска
 */
async function search(query: string, topK = 3) {
  // 1. embedding запроса
  const queryEmbedding = await getEmbedding(query);

  // 2. загрузка индекса
  const indexPath = path.resolve("data/index.json");
  const index: IndexItem[] = JSON.parse(fs.readFileSync(indexPath, "utf-8"));

  // 3. считаем сходство для каждого чанка
  const scored = index.map((item) => {
    const score = cosineSimilarity(queryEmbedding, item.embedding);
    return { ...item, score };
  });

  // 4. сортируем по убыванию семантической близости
  scored.sort((a, b) => b.score - a.score);

  // 5. выводим top-K
  console.log(`\nТоп-${topK} результатов для запроса: "${query}"\n`);
  for (let i = 0; i < Math.min(topK, scored.length); i++) {
    const res = scored[i];
    console.log(`=== Результат ${i + 1} (score: ${res.score.toFixed(4)}) ===`);
    console.log(`Источник: ${res.source}`);
    console.log(res.chunk.slice(0, 100));
    console.log("");
  }
}

// Запуск через CLI: node src/search.ts "какой-то вопрос"
const query = process.argv.slice(2).join(" ");

if (!query) {
  console.error("Укажите текст запроса, пример:");
  console.error('npm run search -- "о чём документ?"');
  process.exit(1);
}

search(query);
