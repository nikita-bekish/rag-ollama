import { answerWithRAG, answerWithoutRAG } from "./ragPipeline";

/**
 * Сравнить ответы с RAG и без RAG для одного вопроса
 */
async function compareAnswers(question: string) {
  console.log("=".repeat(80));
  console.log("ВОПРОС:", question);
  console.log("=".repeat(80));

  // 1. Ответ БЕЗ RAG
  console.log("\n🔹 РЕЖИМ БЕЗ RAG (только знания модели):");
  console.log("-".repeat(80));
  try {
    const answerWithout = await answerWithoutRAG(question);
    console.log(answerWithout.trim());
  } catch (err: any) {
    console.error("Ошибка:", err.message);
  }

  // 2. Ответ С RAG
  console.log("\n🔹 РЕЖИМ С RAG (с контекстом из документов):");
  console.log("-".repeat(80));
  try {
    const answerWith = await answerWithRAG(question);
    console.log(answerWith.trim());
  } catch (err: any) {
    console.error("Ошибка:", err.message);
  }

  console.log("\n" + "=".repeat(80) + "\n");
}

async function main() {
  console.log("\n🚀 Сравнение режимов: БЕЗ RAG vs С RAG\n");

  // Вопрос 1: Конкретная информация о продукте
  await compareAnswers("Сколько стоит КвантумЗащита Про в год?");

  // Вопрос 2: Технические детали API
  await compareAnswers("Какой лимит запросов для эндпоинта шифрования?");

  // Вопрос 3: Внутренняя политика
  await compareAnswers(
    "Сколько отпускных дней у сотрудника с 4 годами стажа в ТехноВолна?"
  );

  // Вопрос 4: Контактная информация
  await compareAnswers("Какой телефон экстренного контакта в ТехноВолна?");

  console.log("✅ Сравнение завершено!");
}

// Запуск
main().catch((err) => {
  console.error("Критическая ошибка:", err);
  process.exit(1);
});
