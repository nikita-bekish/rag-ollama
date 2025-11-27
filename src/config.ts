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
export const MIN_SIMILARITY_SCORE = 0.45;

/**
 * Веса для реранкинга
 * Увеличен вес keyword matching для улучшения поиска
 */
export const RERANKING_WEIGHTS = {
  semantic: 0.6, // вес cosine similarity (семантическая близость)
  keyword: 0.4, // вес keyword matching (точное совпадение слов)
};

/**
 * Количество чанков для возврата после фильтрации
 * Увеличено с 3 до 5 для лучшего покрытия
 */
export const TOP_K_CHUNKS = 5;

// ============================================
// Параметры LLM для контроля галлюцинаций
// ============================================

/**
 * Temperature для LLM (контролирует креативность)
 * - 0.0-0.3: очень консервативно, детерминировано
 * - 0.3-0.7: сбалансировано
 * - > 0.7: очень креативно (много галлюцинаций)
 */
export const LLM_TEMPERATURE = 0.2;

/**
 * Top-P параметр (nucleus sampling)
 * Используется для ограничения выбора токенов
 */
export const LLM_TOP_P = 0.8;
