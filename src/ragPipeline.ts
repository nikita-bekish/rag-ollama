import fs from "fs";
import path from "path";
import type { IndexItem } from "./buildIndex";
import { getEmbedding } from "./embeddings";
import { generateText } from "./llm";

/**
 * Косинусное сходство между двумя векторами
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
 * Найти топ-N наиболее релевантных чанков для вопроса
 */
async function findRelevantChunks(
  question: string,
  topK = 3
): Promise<Array<{ chunk: string; source: string; score: number }>> {
  // 1. Получаем embedding для вопроса
  const questionEmbedding = await getEmbedding(question);

  // 2. Загружаем индекс
  const indexPath = path.resolve("data/index.json");
  const index: IndexItem[] = JSON.parse(fs.readFileSync(indexPath, "utf-8"));

  // 3. Считаем сходство для каждого чанка
  const scored = index.map((item) => ({
    chunk: item.chunk,
    source: item.source,
    score: cosineSimilarity(questionEmbedding, item.embedding),
  }));

  // 4. Сортируем по убыванию и берём топ-K
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, topK);
}

/**
 * RAG Pipeline: вопрос → поиск чанков → генерация ответа
 */
export async function answerWithRAG(
  question: string,
  topK = 3
): Promise<string> {
  // 1. Найти релевантные чанки
  const relevantChunks = await findRelevantChunks(question, topK);

  // 2. Сформировать контекст из чанков
  const context = relevantChunks
    .map((item, idx) => `[${idx + 1}] ${item.chunk}`)
    .join("\n\n");

  // 3. Создать промпт для LLM
  const prompt = `Ты — полезный помощник. Отвечай на вопрос, используя ТОЛЬКО информацию из контекста ниже. Будь точным и лаконичным. Отвечай на русском языке.

Контекст:
${context}

Вопрос: ${question}

Ответ:`;

  // 4. Получить ответ от LLM
  const answer = await generateText(prompt);

  return answer;
}

/**
 * Ответ БЕЗ RAG — LLM отвечает только на основе своих знаний
 */
export async function answerWithoutRAG(question: string): Promise<string> {
  const prompt = `Ты — полезный помощник. Ответь на вопрос четко и точно на русском языке.

Вопрос: ${question}

Ответ:`;

  const answer = await generateText(prompt);
  return answer;
}
