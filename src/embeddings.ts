// src/embeddings.ts
import axios from "axios";
import { EMBEDDING_MODEL, OLLAMA_EMBEDDINGS_URL } from "./config";

export type EmbeddingVector = number[];

/**
 * Получить embedding-вектор для текста через Ollama
 */
export async function getEmbedding(text: string): Promise<EmbeddingVector> {
  try {
    const response = await axios.post(OLLAMA_EMBEDDINGS_URL, {
      model: EMBEDDING_MODEL,
      prompt: text,
    });

    if (!response.data || !Array.isArray(response.data.embedding)) {
      throw new Error("Некорректный ответ от Ollama: нет embedding");
    }

    return response.data.embedding;
  } catch (err: any) {
    console.error("Ошибка при запросе к Ollama embeddings:", err.message);
    throw err;
  }
}
