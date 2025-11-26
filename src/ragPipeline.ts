import fs from "fs";
import path from "path";
import type { IndexItem } from "./buildIndex";
import { MIN_SIMILARITY_SCORE, TOP_K_CHUNKS } from "./config";
import { getEmbedding } from "./embeddings";
import { generateText } from "./llm";
import {
  filterByThreshold,
  rerankKeywordBased,
  type ScoredChunk,
} from "./reranker";

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
 * Найти релевантные чанки с фильтрацией и реранкингом
 */
async function findRelevantChunks(
  question: string,
  options: {
    topK?: number;
    minScore?: number;
    useReranking?: boolean;
  } = {}
): Promise<ScoredChunk[]> {
  const {
    topK = TOP_K_CHUNKS,
    minScore = MIN_SIMILARITY_SCORE,
    useReranking = true,
  } = options;

  // 1. Получаем embedding для вопроса
  const questionEmbedding = await getEmbedding(question);

  // 2. Загружаем индекс
  const indexPath = path.resolve("data/index.json");
  const index: IndexItem[] = JSON.parse(fs.readFileSync(indexPath, "utf-8"));

  // 3. Считаем сходство для каждого чанка
  const scored: ScoredChunk[] = index.map((item) => ({
    chunk: item.chunk,
    source: item.source,
    score: cosineSimilarity(questionEmbedding, item.embedding),
  }));

  // 4. Сортируем по убыванию
  scored.sort((a, b) => b.score - a.score);

  // 5. Фильтруем по минимальному порогу
  const filtered = filterByThreshold(scored, minScore);

  // 6. Применяем реранкинг (если включен)
  const final = useReranking
    ? rerankKeywordBased(question, filtered)
    : filtered;

  // 7. Берём топ-K
  return final.slice(0, topK);
}

/**
 * RAG Pipeline с фильтрацией и реранкингом
 */
export async function answerWithRAG(
  question: string,
  options: {
    topK?: number;
    minScore?: number;
    useReranking?: boolean;
  } = {}
): Promise<string> {
  // 1. Найти релевантные чанки
  const relevantChunks = await findRelevantChunks(question, options);

  // 2. Если ничего не найдено после фильтрации
  if (relevantChunks.length === 0) {
    return "К сожалению, в документах нет релевантной информации для ответа на этот вопрос.";
  }

  // 3. Сформировать контекст из чанков
  const context = relevantChunks
    .map((item, idx) => `[${idx + 1}] ${item.chunk}`)
    .join("\n\n");

  // 4. Создать промпт для LLM
  const prompt = `Ты — полезный помощник. Отвечай на вопрос, используя ТОЛЬКО информацию из контекста ниже. Будь точным и лаконичным. Отвечай на русском языке.

Контекст:
${context}

Вопрос: ${question}

Ответ:`;

  // 5. Получить ответ от LLM
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

/**
 * Получить детальную информацию о найденных чанках (для отладки)
 */
export async function findRelevantChunksWithDetails(
  question: string,
  options: {
    topK?: number;
    minScore?: number;
    useReranking?: boolean;
  } = {}
): Promise<{
  chunks: ScoredChunk[];
  totalFound: number;
  filtered: number;
}> {
  const { minScore = MIN_SIMILARITY_SCORE } = options;

  // Найти без фильтра
  const allChunks = await findRelevantChunks(question, {
    ...options,
    minScore: 0, // отключить фильтр
    useReranking: false, // без реранкинга
    topK: 100, // все результаты
  });

  // Найти с фильтром
  const filteredChunks = await findRelevantChunks(question, options);

  return {
    chunks: filteredChunks,
    totalFound: allChunks.length,
    filtered:
      allChunks.length - allChunks.filter((c) => c.score >= minScore).length,
  };
}
