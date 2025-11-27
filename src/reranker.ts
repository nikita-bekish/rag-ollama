import { RERANKING_WEIGHTS } from "./config";

export interface ScoredChunk {
  chunk: string; // текст чанка
  source: string; // имя файла (company_handbook.md)
  chunkId: string; // ID чанка (company_handbook.md-chunk-0)
  score: number; // релевантность
}

function extractKeywords(text: string): Set<string> {
  const stopWords = new Set([
    "в",
    "и",
    "на",
    "с",
    "по",
    "для",
    "от",
    "к",
    "о",
    "из",
    "у",
    "за",
    "при",
    "не",
    "что",
    "это",
    "как",
    "его",
    "то",
    "все",
    "она",
    "так",
    "но",
    "а",
    "же",
    "ли",
    "или",
    "да",
    "был",
    "была",
    "было",
    "были",
    "быть",
    "есть",
    "чтобы",
    "если",
    "когда",
    "где",
    "куда",
    "почему",
  ]);

  const normalized = text.toLowerCase().replace(/[.,!?;:(){}[\]"'«»—–-]/g, " ");

  const words = normalized.split(/\s+/).filter((w) => w.length > 2);

  const keywords = new Set(words.filter((w) => !stopWords.has(w)));

  return keywords;
}

function calculateKeywordSimilarity(
  queryKeywords: Set<string>,
  chunkKeywords: Set<string>
): number {
  const intersection = new Set(
    [...queryKeywords].filter((kw) => chunkKeywords.has(kw))
  );

  const union = new Set([...queryKeywords, ...chunkKeywords]);

  if (union.size === 0) return 0;

  return intersection.size / union.size;
}

export function rerankKeywordBased(
  query: string,
  chunks: ScoredChunk[]
): ScoredChunk[] {
  // Извлекаем ключевые слова из вопроса
  const queryKeywords = extractKeywords(query);

  const reranked = chunks.map((item) => {
    const chunkKeywords = extractKeywords(item.chunk);
    const keywordScore = calculateKeywordSimilarity(
      queryKeywords,
      chunkKeywords
    );

    const finalScore =
      RERANKING_WEIGHTS.semantic * item.score +
      RERANKING_WEIGHTS.keyword * keywordScore;

    return {
      ...item,
      score: finalScore,
      _debug: {
        originalScore: item.score,
        keywordScore,
        finalScore,
      },
    };
  });

  reranked.sort((a, b) => b.score - a.score);

  return reranked;
}

export function filterByThreshold(
  chunks: ScoredChunk[],
  minScore: number
): ScoredChunk[] {
  return chunks.filter((chunk) => chunk.score >= minScore);
}
