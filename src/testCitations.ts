import {
  answerWithRAG,
  answerWithoutRAG,
  type AnswerWithSources,
} from "./ragPipeline";

/**
 * Форматирование ответа с источниками
 */
function formatAnswerWithSources(result: AnswerWithSources): string {
  let output = result.answer.trim();

  // Добавляем секцию "Источники"
  if (result.sources.length > 0) {
    output += "\n\n📚 ИСТОЧНИКИ:\n";
    output += "─".repeat(80) + "\n";

    result.sources.forEach((source) => {
      output += `${source.id} ${source.file} (${source.chunkId})\n`;
      output += `   Score: ${source.score.toFixed(4)}\n`;
      output += `   "${source.preview}"\n\n`;
    });
  }

  // Добавляем статус цитирования
  output += "🔍 СТАТУС ЦИТИРОВАНИЯ:\n";
  output += "─".repeat(80) + "\n";
  output += `Найдено цитат: ${result.foundCitations.join(", ") || "нет"}\n`;
  output += `Все источники процитированы: ${
    result.hasAllCitations ? "✅ ДА" : "⚠️ НЕТ"
  }\n`;

  // Добавляем предупреждения о галлюцинациях
  if (result.hallucinations.length > 0) {
    output += "\n⚠️ ВОЗМОЖНЫЕ ГАЛЛЮЦИНАЦИИ:\n";
    output += "─".repeat(80) + "\n";
    result.hallucinations.forEach((issue) => {
      output += `${issue}\n`;
    });
  } else {
    output += "\n✅ Галлюцинаций не обнаружено\n";
  }

  return output;
}

/**
 * Результат одного теста
 */
interface TestResult {
  questionNum: number;
  question: string;
  answerWithRAG: AnswerWithSources | null;
  error: string | null;
}

/**
 * Тестирование одного вопроса
 */
async function testQuestion(
  questionNum: number,
  question: string,
  expectedBehavior: string
): Promise<TestResult> {
  console.log("\n" + "=".repeat(80));
  console.log(`ТЕСТ ${questionNum}: ${question}`);
  console.log("Ожидаемое поведение: " + expectedBehavior);
  console.log("=".repeat(80));

  let ragResult: AnswerWithSources | null = null;
  let error: string | null = null;

  // Режим 1: БЕЗ RAG (baseline)
  console.log("\n🔹 РЕЖИМ БЕЗ RAG:");
  console.log("-".repeat(80));
  try {
    const answerNoRAG = await answerWithoutRAG(question);
    console.log(answerNoRAG.trim());
  } catch (err: any) {
    console.error("Ошибка:", err.message);
  }

  // Режим 2: С RAG И ЦИТАТАМИ
  console.log("\n🔹 РЕЖИМ С RAG И ЦИТАТАМИ:");
  console.log("-".repeat(80));
  try {
    ragResult = await answerWithRAG(question);
    console.log(formatAnswerWithSources(ragResult));
  } catch (err: any) {
    error = (err as any).message;
    console.error("Ошибка:", error);
  }

  console.log("\n" + "=".repeat(80) + "\n");

  return { questionNum, question, answerWithRAG: ragResult, error };
}

/**
 * Форматирование результата для таблицы
 */
function formatTestResult(result: TestResult): {
  answer: string;
  status: string;
  flags: string;
} {
  if (!result.answerWithRAG) {
    return {
      answer: result.error || "Ошибка выполнения",
      status: "❌ Ошибка",
      flags: "🔴 КРИТИЧЕСКАЯ ОШИБКА",
    };
  }

  const { answer, foundCitations, hallucinations } = result.answerWithRAG;

  // Вытаскиваем первые 30 символов ответа для таблицы
  const answerPreview = answer.trim().substring(0, 40);

  // Определяем статус и флаги на основе реальных данных
  let status = "❓ Неопределен";
  let flags = "🟡 Проверить";

  // Проверяем наличие ошибок
  if (hallucinations && hallucinations.length > 0) {
    if (hallucinations.some((h) => h.includes("КРАСНЫЙ"))) {
      flags = "🔴 КРАСНЫЙ ФЛАГ";
    } else if (hallucinations.some((h) => h.includes("ЖЕЛТЫЙ"))) {
      flags = "🟡 ЖЕЛТЫЙ ФЛАГ";
    }
  } else {
    flags = "✅ OK";
  }

  // Определяем статус ответа
  if (answer.toLowerCase().includes("в документах нет")) {
    status = "✅ Честный отказ";
  } else if (foundCitations.length > 0) {
    status = "✅ С цитатами";
  } else if (answer.length > 0) {
    status = "⚠️ Без цитат";
  }

  return { answer: answerPreview, status, flags };
}

/**
 * Главная функция — 5 тестовых вопросов
 */
async function main() {
  console.log("\n🚀 ТЕСТИРОВАНИЕ СИСТЕМЫ ЦИТИРОВАНИЯ\n");
  console.log("Цель: Проверить, что модель обязательно указывает источники\n");

  const results: TestResult[] = [];

  // ТЕСТ 1: Точный факт из одного документа
  results.push(
    await testQuestion(
      1,
      "Сколько стоит КвантумЗащита Про в год?",
      "Ответ с цитатой [1], источник: company_handbook.md"
    )
  );

  // ТЕСТ 2: Технический вопрос (API)
  results.push(
    await testQuestion(
      2,
      "Какой лимит запросов для эндпоинта шифрования?",
      "Ответ с цитатой [1], источник: api_documentation.md"
    )
  );

  // ТЕСТ 3: Политика компании
  results.push(
    await testQuestion(
      3,
      "Сколько отпускных дней у сотрудника с 5 годами стажа в ТехноВолна?",
      "Ответ с цитатой [1], источник: company_handbook.md"
    )
  );

  // ТЕСТ 4: Вопрос, требующий нескольких источников
  results.push(
    await testQuestion(
      4,
      "Какие продукты предлагает ТехноВолна и сколько они стоят?",
      "Ответ с цитатами [1][2], несколько источников из company_handbook.md"
    )
  );

  // ТЕСТ 5: Нерелевантный вопрос (проверка честности)
  results.push(
    await testQuestion(
      5,
      "Какая погода в Москве сегодня?",
      "Честный отказ: 'В документах нет информации', нет цитат"
    )
  );

  console.log("✅ Тестирование завершено!\n");

  // Итоговая таблица результатов
  console.log("📊 ИТОГОВАЯ ТАБЛИЦА РЕЗУЛЬТАТОВ:");
  console.log("─".repeat(140));
  console.log(
    "№ | Вопрос                              | Ответ (превью)            | Статус          | Флаги"
      .padEnd(140)
  );
  console.log("─".repeat(140));

  let successCount = 0;
  let redFlags = 0;
  let yellowFlags = 0;

  results.forEach((result) => {
    const { answer, status, flags } = formatTestResult(result);

    // Сокращаем вопрос для таблицы
    const questionShort = result.question.substring(0, 35).padEnd(35);
    const answerShort = answer.padEnd(25);
    const statusShort = status.padEnd(16);

    console.log(
      `${result.questionNum} | ${questionShort} | ${answerShort} | ${statusShort} | ${flags}`
        .padEnd(140)
    );

    // Считаем статистику
    if (status.includes("✅")) successCount++;
    if (flags.includes("КРАСНЫЙ")) redFlags++;
    if (flags.includes("ЖЕЛТЫЙ")) yellowFlags++;
  });

  console.log("─".repeat(140));

  // Статистика
  console.log("\n📈 СТАТИСТИКА:");
  console.log("─".repeat(80));
  console.log(`✅ Успешных тестов: ${successCount}/5 (${(successCount * 20).toFixed(0)}%)`);
  console.log(`🔴 Критических проблем (RED FLAG): ${redFlags}`);
  console.log(`🟡 Предупреждений (YELLOW FLAG): ${yellowFlags}`);
  console.log("\n💡 ВЫВОДЫ:");
  console.log("  • Проверьте логику ответов в таблице выше");
  console.log("  • Обратите внимание на флаги для каждого теста");
  console.log("  • RED FLAG указывает на критические ошибки");
  console.log("  • YELLOW FLAG указывает на потенциальные проблемы");
}

// Запуск
main().catch((err) => {
  console.error("Критическая ошибка:", err);
  process.exit(1);
});
