import { MIN_SIMILARITY_SCORE } from "./config";
import {
  answerWithRAG,
  answerWithoutRAG,
  findRelevantChunksWithDetails,
} from "./ragPipeline";

/**
 * Визуализация найденных чанков
 */
function displayChunks(
  chunks: Array<{ chunk: string; source: string; score: number }>,
  title: string
) {
  console.log(`\n${title}`);
  console.log("-".repeat(80));

  if (chunks.length === 0) {
    console.log("❌ Не найдено релевантных чанков");
    return;
  }

  chunks.forEach((item, idx) => {
    const preview = item.chunk.slice(0, 80).replace(/\n/g, " ");
    console.log(
      `  ${idx + 1}. [score: ${item.score.toFixed(4)}] ${preview}...`
    );
    console.log(`     Источник: ${item.source}`);
  });
}

/**
 * Сравнить три режима для одного вопроса
 */
async function compareModesForQuestion(question: string) {
  console.log("\n" + "=".repeat(80));
  console.log(`ВОПРОС: ${question}`);
  console.log("=".repeat(80));

  // ============================================
  // Режим 1: Без RAG (baseline)
  // ============================================
  console.log("\n🔹 РЕЖИМ 1: БЕЗ RAG (baseline)");
  console.log("-".repeat(80));
  try {
    const answerNoRAG = await answerWithoutRAG(question);
    console.log(answerNoRAG.trim());
  } catch (err: any) {
    console.error("Ошибка:", err.message);
  }

  // ============================================
  // Режим 2: RAG без фильтра и реранкинга
  // ============================================
  console.log("\n🔹 РЕЖИМ 2: RAG БЕЗ ФИЛЬТРА И РЕРАНКИНГА");
  try {
    const details2 = await findRelevantChunksWithDetails(question, {
      minScore: 0, // без фильтра
      useReranking: false,
      topK: 3,
    });

    displayChunks(details2.chunks, "📋 Найденные чанки:");

    const answer2 = await answerWithRAG(question, {
      minScore: 0,
      useReranking: false,
      topK: 3,
    });

    console.log("\n💬 Ответ:");
    console.log("-".repeat(80));
    console.log(answer2.trim());
  } catch (err: any) {
    console.error("Ошибка:", err.message);
  }

  // ============================================
  // Режим 3: RAG с фильтром, без реранкинга
  // ============================================
  console.log("\n🔹 РЕЖИМ 3: RAG С ФИЛЬТРОМ (score >= 0.3), БЕЗ РЕРАНКИНГА");
  try {
    const details3 = await findRelevantChunksWithDetails(question, {
      minScore: MIN_SIMILARITY_SCORE,
      useReranking: false,
      topK: 3,
    });

    console.log(
      `\n📊 Статистика: найдено ${details3.totalFound} чанков, отфильтровано ${details3.filtered}`
    );

    displayChunks(details3.chunks, "📋 Чанки после фильтрации:");

    const answer3 = await answerWithRAG(question, {
      minScore: MIN_SIMILARITY_SCORE,
      useReranking: false,
      topK: 3,
    });

    console.log("\n💬 Ответ:");
    console.log("-".repeat(80));
    console.log(answer3.trim());
  } catch (err: any) {
    console.error("Ошибка:", err.message);
  }

  // ============================================
  // Режим 4: RAG с фильтром и реранкингом
  // ============================================
  console.log("\n🔹 РЕЖИМ 4: RAG С ФИЛЬТРОМ И РЕРАНКИНГОМ (полная версия)");
  try {
    const details4 = await findRelevantChunksWithDetails(question, {
      minScore: MIN_SIMILARITY_SCORE,
      useReranking: true,
      topK: 3,
    });

    console.log(
      `\n📊 Статистика: найдено ${details4.totalFound} чанков, отфильтровано ${details4.filtered}`
    );

    displayChunks(details4.chunks, "📋 Чанки после фильтрации и реранкинга:");

    const answer4 = await answerWithRAG(question, {
      minScore: MIN_SIMILARITY_SCORE,
      useReranking: true,
      topK: 3,
    });

    console.log("\n💬 Ответ:");
    console.log("-".repeat(80));
    console.log(answer4.trim());
  } catch (err: any) {
    console.error("Ошибка:", err.message);
  }

  console.log("\n" + "=".repeat(80) + "\n");
}

/**
 * Главная функция
 */
async function main() {
  console.log("\n🚀 Сравнение режимов RAG: фильтрация и реранкинг\n");

  // Вопрос 1: Точная информация из документа
  await compareModesForQuestion("Сколько стоит КвантумЗащита Про в год?");

  // Вопрос 2: Технические детали (проблемный вопрос из прошлого теста)
  await compareModesForQuestion(
    "Какой лимит запросов для эндпоинта шифрования?"
  );

  // Вопрос 3: Политика компании
  await compareModesForQuestion(
    "Сколько отпускных дней у сотрудника с 4 годами стажа в ТехноВолна?"
  );

  // Вопрос 4: Нерелевантный вопрос (для проверки фильтрации)
  await compareModesForQuestion("Какая погода в Москве сегодня?");

  console.log("✅ Сравнение завершено!");
}

// Запуск
main().catch((err) => {
  console.error("Критическая ошибка:", err);
  process.exit(1);
});
