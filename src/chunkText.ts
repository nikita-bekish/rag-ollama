// src/chunkText.ts

export interface Chunk {
  id: string; // например "example1.txt-chunk-0"
  source: string; // docs/example1.txt
  text: string; // текст чанка
}

/**
 * Разбивка текста на чанки по фиксированному размеру (по символам)
 * @param text — входной текст
 * @param source — откуда текст взяли (имя файла)
 * @param chunkSize — размер чанка по символам
 * @param overlap — ширина перекрытия
 */
export function chunkText(
  text: string,
  source: string,
  chunkSize = 500,
  overlap = 100
): Chunk[] {
  const chunks: Chunk[] = [];

  let start = 0;
  let index = 0;

  while (start < text.length) {
    const end = start + chunkSize;
    const chunkText = text.slice(start, end).trim();

    if (chunkText.length > 0) {
      chunks.push({
        id: `${source}-chunk-${index}`,
        source,
        text: chunkText,
      });
    }

    start += chunkSize - overlap;
    index++;
  }

  return chunks;
}
