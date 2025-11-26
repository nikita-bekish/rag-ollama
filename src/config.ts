export const OLLAMA_EMBEDDINGS_URL = "http://localhost:11434/api/embeddings";

export const EMBEDDING_MODEL = "nomic-embed-text";

export const OLLAMA_GENERATE_URL = "http://localhost:11434/api/generate";

export const LLM_MODEL = "llama3.2";

// ============================================
// Настройки фильтрации и реранкинга
// ============================================

/**
 * Минимальный порог cosine similarity для фильтрации чанков
 * Значения: 0.0-1.0
 * - < 0.3: слабая релевантность (отфильтруется)
 * - 0.3-0.5: средняя релевантность
 * - > 0.5: высокая релевантность
 */
export const MIN_SIMILARITY_SCORE = 0.3;

/**
 * Веса для реранкинга
 */
export const RERANKING_WEIGHTS = {
  semantic: 0.7, // вес cosine similarity (семантическая близость)
  keyword: 0.3, // вес keyword matching (точное совпадение слов)
};

/**
 * Количество чанков для возврата после фильтрации
 */
export const TOP_K_CHUNKS = 3;
