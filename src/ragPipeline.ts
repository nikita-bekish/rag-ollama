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
 * Информация об источнике цитаты
 */
export interface CitationSource {
  id: string; // "[1]", "[2]", etc.
  file: string; // "company_handbook.md"
  chunkId: string; // "chunk-0"
  preview: string; // первые 150 символов чанка
  score: number; // релевантность (cosine similarity)
}

/**
 * Ответ с цитатами и источниками
 */
export interface AnswerWithSources {
  answer: string; // текст ответа от LLM
  sources: CitationSource[]; // список всех источников
  foundCitations: string[]; // цитаты, найденные в ответе: ["[1]", "[2]"]
  hasAllCitations: boolean; // true если все источники процитированы
  hallucinations: string[]; // предупреждения о возможных галлюцинациях
}

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
 * Парсинг цитат из ответа LLM
 * Ищет паттерны [1], [2], [3] и т.д.
 */
function parseCitations(
  answerText: string,
  totalSources: number
): { foundCitations: string[]; hasAllCitations: boolean } {
  // Регулярное выражение для поиска [1], [2], [3] и т.д.
  const citationPattern = /\[(\d+)\]/g;
  const matches = answerText.matchAll(citationPattern);

  // Собираем все найденные номера
  const foundNumbers = new Set<number>();
  for (const match of matches) {
    const num = parseInt(match[1], 10);
    if (num >= 1 && num <= totalSources) {
      foundNumbers.add(num);
    }
  }

  // Формируем массив строк ["[1]", "[2]"]
  const foundCitations = Array.from(foundNumbers)
    .sort((a, b) => a - b)
    .map((n) => `[${n}]`);

  // Проверяем, что все источники процитированы
  const hasAllCitations = foundNumbers.size === totalSources;

  return { foundCitations, hasAllCitations };
}

/**
 * Валидация ответа на предмет галлюцинаций
 * Проверяет, что основные факты находятся в источниках И релевантны вопросу
 */
function validateAnswerHallucinations(
  answerText: string,
  relevantChunks: { chunk: string }[],
  question?: string
): { hasHallucinations: boolean; issues: string[] } {
  const issues: string[] = [];

  // Если ответ — "нет информации", это ОК
  if (
    answerText.toLowerCase().includes("нет информации") ||
    answerText.toLowerCase().includes("из документов нет")
  ) {
    return { hasHallucinations: false, issues: [] };
  }

  // Проверяем, что есть хотя бы одна цитата
  const citationCount = (answerText.match(/\[\d+\]/g) || []).length;
  if (citationCount === 0) {
    issues.push("⚠️ КРАСНЫЙ ФЛАГ: Нет цитат в ответе — высокий риск галлюцинации");
  }

  // Объединяем все источники в одну строку для проверки
  const chunksText = relevantChunks.map((c) => c.chunk).join(" ");
  const chunksTextLower = chunksText.toLowerCase();

  // Стоп-слова (исключаются при проверке)
  const stopWords = new Set([
    "это",
    "что",
    "как",
    "для",
    "на",
    "в",
    "и",
    "или",
    "но",
    "из",
    "с",
    "по",
    "от",
    "к",
    "у",
    "о",
    "при",
    "до",
    "после",
    "является",
    "являются",
  ]);

  const answerWords = answerText
    .toLowerCase()
    .split(/[\s\.,!?;:()\[\]]+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));

  // Проверяем, что хотя бы большинство значимых слов из ответа есть в источниках
  let matchedWords = 0;

  for (const word of answerWords) {
    if (chunksTextLower.includes(word)) {
      matchedWords++;
    }
  }

  // Если менее 40% слов найдено в источниках — это подозрительно
  const matchPercentage = (matchedWords / answerWords.length) * 100;
  if (answerWords.length > 5 && matchPercentage < 40) {
    issues.push(
      `⚠️ ЖЕЛТЫЙ ФЛАГ: ${matchPercentage.toFixed(0)}% ответа найдено в источниках (минимум 40%)`
    );
  }

  // Проверяем числа и цены — они должны быть в источниках
  const numbers = answerText.match(/\d{2,}/g) || [];
  for (const number of numbers) {
    if (!chunksText.includes(number)) {
      issues.push(`⚠️ ЖЕЛТЫЙ ФЛАГ: Число "${number}" не найдено в источниках`);
    }
  }

  // НОВАЯ ПРОВЕРКА: Релевантность ответа на вопрос
  if (question) {
    const questionWords = question
      .toLowerCase()
      .split(/[\s\.,!?;:()\[\]]+/)
      .filter((w) => w.length > 2 && !stopWords.has(w));

    // Проверяем, совпадают ли ключевые слова вопроса и ответа
    const answerWordSet = new Set(answerWords);
    let questionWordsMatched = 0;

    for (const qWord of questionWords) {
      if (answerWordSet.has(qWord)) {
        questionWordsMatched++;
      }
    }

    // Если менее 30% ключевых слов вопроса присутствует в ответе — возможно неправильный ответ
    const questionMatchPercentage =
      (questionWordsMatched / questionWords.length) * 100;
    if (
      questionWords.length > 2 &&
      questionMatchPercentage < 30
    ) {
      issues.push(
        `⚠️ ЖЕЛТЫЙ ФЛАГ: Ответ слабо соответствует вопросу (${questionMatchPercentage.toFixed(0)}% совпадения ключевых слов)`
      );
    }
  }

  const hasHallucinations = issues.length > 0;
  return { hasHallucinations, issues };
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
    chunkId: item.id, // 🆕 добавили ID чанка
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
 * Извлечь наиболее релевантный фрагмент из чанка на основе текста ответа
 */
function extractRelevantFragment(
  chunkText: string,
  answerText: string
): string {
  if (!answerText || answerText.length === 0) {
    return chunkText.slice(0, 150) + "...";
  }

  // Стратегия 1: Попробуем найти точное совпадение текста ответа в чанке
  // Это работает для прямых цитат, чисел, названий
  const answerLower = answerText.toLowerCase();
  const chunkLower = chunkText.toLowerCase();
  const answerIndex = chunkLower.indexOf(answerLower);

  if (answerIndex !== -1) {
    // Нашли точное совпадение — расширяем вокруг него до границы предложения
    const startIndex = Math.max(0, answerIndex - 20); // 20 символов до
    const endIndex = Math.min(
      chunkText.length,
      answerIndex + answerText.length + 50
    ); // 50 символов после

    let start = startIndex;
    let end = endIndex;

    // Ищем начало предложения (точка/восклицание/вопрос)
    for (let i = answerIndex - 1; i >= 0; i--) {
      if (chunkText[i] === "." || chunkText[i] === "!" || chunkText[i] === "?") {
        start = i + 2; // после точки и пробела
        break;
      }
      if (i === 0) start = 0;
    }

    // Ищем конец предложения
    for (let i = answerIndex + answerText.length; i < chunkText.length; i++) {
      if (chunkText[i] === "." || chunkText[i] === "!" || chunkText[i] === "?") {
        end = i + 1; // включая точку
        break;
      }
    }

    const fragment = chunkText.slice(start, end).trim();
    if (fragment.length > 10) {
      return fragment.slice(0, 250) + (fragment.length > 250 ? "..." : "");
    }
  }

  // Стратегия 2: Найти предложение с наибольшим совпадением ключевых слов
  const stopWords = new Set([
    "это",
    "что",
    "как",
    "для",
    "на",
    "в",
    "и",
    "или",
    "но",
    "да",
    "нет",
    "то",
    "от",
    "по",
    "as",
    "the",
    "is",
    "a",
    "an",
    "and",
    "or",
    "but",
    "in",
    "at",
    "of",
    "to",
    "be",
  ]);

  // Извлекаем все слова из ответа (включая короткие)
  const answerWords = answerText
    .toLowerCase()
    .split(/[\s\.,!?;:\[\]()]+/)
    .filter((w) => w.length > 0 && !stopWords.has(w));

  if (answerWords.length === 0) {
    return chunkText.slice(0, 150) + "...";
  }

  // Разбиваем чанк на предложения
  const sentences = chunkText
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  // Ищем предложение с наибольшим количеством совпадений слов
  let bestSentence = sentences[0] || chunkText.slice(0, 150);
  let maxMatches = 0;

  for (const sentence of sentences) {
    const sentenceLower = sentence.toLowerCase();
    const matches = answerWords.filter((word) =>
      sentenceLower.includes(word)
    ).length;

    // Даже одно совпадение лучше, чем использовать первое предложение
    if (matches > maxMatches) {
      maxMatches = matches;
      bestSentence = sentence;
    }
  }

  return bestSentence.slice(0, 250) + (bestSentence.length > 250 ? "..." : "");
}

/**
 * RAG Pipeline с фильтрацией, реранкингом и ЦИТАТАМИ
 */
export async function answerWithRAG(
  question: string,
  options: {
    topK?: number;
    minScore?: number;
    useReranking?: boolean;
  } = {}
): Promise<AnswerWithSources> {
  // 1. Найти релевантные чанки
  const relevantChunks = await findRelevantChunks(question, options);

  // 2. Если ничего не найдено после фильтрации
  if (relevantChunks.length === 0) {
    return {
      answer:
        "К сожалению, в документах нет релевантной информации для ответа на этот вопрос.",
      sources: [],
      foundCitations: [],
      hasAllCitations: false,
      hallucinations: [],
    };
  }

  // 3. Формируем контекст с номерами источников
  const contextParts = relevantChunks.map((item, idx) => {
    const sourceNum = idx + 1;
    return `[${sourceNum}] (Источник: ${item.source})\n${item.chunk}`;
  });
  const context = contextParts.join("\n\n");

  // 4. Создаём промпт с ОБЯЗАТЕЛЬНЫМ требованием цитировать
  const prompt = `Ты — помощник справки по документам. Отвечаешь ТОЛЬКО информацией из документов.

ДОКУМЕНТЫ (КОНТЕКСТ):
${context}

ВОПРОС: ${question}

🔒 ПРАВИЛА (СЛЕДУЙ ТОЧНО):

1️⃣ ИСПОЛЬЗУЙ ТОЛЬКО информацию из документов выше. ЗАПРЕЩЕНО добавлять свои знания или контекст.

2️⃣ КАЖДОЕ предложение с фактом/цифрой/названием ДОЛЖНО ИМЕТЬ номер [1], [2], [3], и т.д. сразу после факта:
   ✅ ПРАВИЛЬНО: "Цена составляет 100 ₽ [1]" или "Компания основана в 2020 году [2]"
   ❌ НЕПРАВИЛЬНО: "По документам цена 100 ₽" или "Основана в 2020"

3️⃣ КАЖДОЕ слово, каждая цифра, каждое число должны быть процитированы.

4️⃣ Если информация относится к источнику [1] — ПИСАТЬ [1], если к [2] — ПИСАТЬ [2].

5️⃣ НЕЛЬЗЯ придумывать, предполагать или добавлять контекст. ТОЛЬКО то, что в документах.

6️⃣ Если нет информации → НАПИШИ ТОЛЬКО: "В документах нет информации по этому вопросу"

7️⃣ Не добавляй фразы "согласно", "в документе", "источник сказал" — только факты с [1], [2].

8️⃣ Отвечай кратко, ясно, на русском языке. Без лишних слов.

⚠️ ПОМНИ: Модель может галлюцинировать! Проверь каждое слово — есть ли оно в контексте выше?

ОТВЕТ:`;

  // 5. Получаем ответ от LLM
  const answerText = await generateText(prompt);

  // 6. Парсим цитаты из ответа
  const { foundCitations, hasAllCitations } = parseCitations(
    answerText,
    relevantChunks.length
  );

  // 7. Формируем список источников
  // Для каждой цитаты находим соответствующий фрагмент в ответе
  const sources: CitationSource[] = relevantChunks.map((item, idx) => {
    const citationNum = idx + 1;

    // Стратегия: собираем контекст вокруг цитаты [N]
    // Ищем предложение, содержащее [N]
    const citationPattern = new RegExp(
      `([^.!?]*?\\[${citationNum}\\][^.!?]*[.!?])`
    );
    const match = answerText.match(citationPattern);
    let answerSnippet = "";

    if (match) {
      // Нашли предложение с цитатой
      answerSnippet = match[1]
        .replace(/\[\d+\]/g, "") // убираем все номера цитат
        .trim();
    } else {
      // Если не нашли полное предложение, ищем просто текст рядом с [N]
      const simplePattern = new RegExp(
        `([^\\[]*?\\[${citationNum}\\][^\\[]*)`
      );
      const simpleMatch = answerText.match(simplePattern);
      if (simpleMatch) {
        answerSnippet = simpleMatch[1]
          .replace(/\[\d+\]/g, "")
          .trim();
      }
    }

    // Если вообще не нашли контекст, используем название источника для поиска
    if (!answerSnippet) {
      answerSnippet = item.source.replace(".md", "");
    }

    const relevantFragment = extractRelevantFragment(item.chunk, answerSnippet);

    return {
      id: `[${citationNum}]`,
      file: item.source,
      chunkId: item.chunkId,
      preview: relevantFragment, // 🆕 конкретный фрагмент вместо просто preview
      score: item.score,
    };
  });

  // 8. Валидируем ответ на галлюцинации (теперь с проверкой релевантности на вопрос)
  const { issues: hallucinations } = validateAnswerHallucinations(
    answerText,
    relevantChunks,
    question  // Передаём вопрос для проверки релевантности
  );

  // 9. Возвращаем полный ответ с источниками и предупреждениями
  return {
    answer: answerText,
    sources,
    foundCitations,
    hasAllCitations,
    hallucinations,
  };
}

/**
 * RAG Pipeline с фильтрацией и реранкингом
 */
// export async function answerWithRAG(
//   question: string,
//   options: {
//     topK?: number;
//     minScore?: number;
//     useReranking?: boolean;
//   } = {}
// ): Promise<string> {
//   // 1. Найти релевантные чанки
//   const relevantChunks = await findRelevantChunks(question, options);

//   // 2. Если ничего не найдено после фильтрации
//   if (relevantChunks.length === 0) {
//     return "К сожалению, в документах нет релевантной информации для ответа на этот вопрос.";
//   }

//   // 3. Сформировать контекст из чанков
//   const context = relevantChunks
//     .map((item, idx) => `[${idx + 1}] ${item.chunk}`)
//     .join("\n\n");

//   // 4. Создать промпт для LLM
//   const prompt = `Ты — полезный помощник. Отвечай на вопрос, используя ТОЛЬКО информацию из контекста ниже. Будь точным и лаконичным. Отвечай на русском языке.

// Контекст:
// ${context}

// Вопрос: ${question}

// Ответ:`;

//   // 5. Получить ответ от LLM
//   const answer = await generateText(prompt);

//   return answer;
// }

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
