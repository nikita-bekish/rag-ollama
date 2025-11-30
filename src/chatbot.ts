import * as readline from "readline";
import { answerWithRAG } from "./ragPipeline";
import { ConversationManager } from "./conversationManager";

/**
 * RAG-Chatbot с памятью разговора
 * Интерактивный CLI интерфейс для многооборотного диалога с RAG
 */
class ChatBot {
  private conversationManager: ConversationManager;
  private rl: readline.Interface;
  private lastRagResult: any = null;
  private isRunning: boolean = true;
  private isClosed: boolean = false;

  constructor() {
    this.conversationManager = new ConversationManager();
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    this.rl.on("close", () => {
      this.isClosed = true;
    });
  }

  /**
   * Запустить чатбот
   */
  async start(): Promise<void> {
    console.log("\n🤖 RAG-Чатбот запущен!");
    console.log(
      "Введите свои вопросы (или /help для справки по командам)\n"
    );
    console.log("─".repeat(80));

    await this.promptLoop();
  }

  /**
   * Основной цикл ввода пользователя
   */
  private promptLoop(): Promise<void> {
    return new Promise((resolve) => {
      const askQuestion = (): void => {
        if (!this.isRunning || this.isClosed) {
          resolve();
          return;
        }

        try {
          this.rl.question("\nYou: ", async (input) => {
            if (input === null || this.isClosed) {
              // EOF reached
              this.isRunning = false;
              resolve();
              return;
            }

            const trimmedInput = input.trim();

            if (!trimmedInput) {
              if (!this.isClosed) {
                askQuestion();
              }
              return;
            }

            // Обработка команд
            if (trimmedInput.startsWith("/")) {
              await this.handleCommand(trimmedInput);
              if (this.isRunning && !this.isClosed) {
                askQuestion();
              } else {
                resolve();
              }
              return;
            }

            // Обработка обычного вопроса
            await this.handleQuestion(trimmedInput);
            if (this.isRunning && !this.isClosed) {
              askQuestion();
            } else {
              resolve();
            }
          });
        } catch (error) {
          // Handle readline closed error
          this.isRunning = false;
          resolve();
        }
      };

      askQuestion();
    });
  }

  /**
   * Обработать команду (/, /history, /clear, etc.)
   */
  private async handleCommand(command: string): Promise<void> {
    const parts = command.split(" ");
    const cmd = parts[0].toLowerCase();

    switch (cmd) {
      case "/history":
        console.log("\n" + this.conversationManager.formatHistoryForDisplay());
        break;

      case "/clear":
        this.conversationManager.clear();
        this.lastRagResult = null;
        console.log("\n✅ История разговора очищена. Начинаем заново!");
        break;

      case "/sources":
        if (!this.lastRagResult) {
          console.log("\n⚠️ Нет источников для последнего ответа");
          break;
        }
        await this.displaySources(this.lastRagResult);
        break;

      case "/export":
        const format = parts[1]?.toLowerCase() || "text";
        this.handleExport(format);
        break;

      case "/help":
        this.displayHelp();
        break;

      case "/exit":
      case "/quit":
        await this.exit();
        break;

      default:
        console.log(`\n❌ Неизвестная команда: ${cmd}`);
        this.displayHelp();
    }
  }

  /**
   * Обработать обычный вопрос через RAG
   */
  private async handleQuestion(question: string): Promise<void> {
    try {
      console.log("\n⏳ Ищу информацию...\n");

      // Получить контекст разговора
      const conversationContext = this.conversationManager
        .formatHistoryForPrompt();

      // Вызвать RAG с контекстом
      const ragResult = await answerWithRAG(question, {
        conversationContext: conversationContext || undefined,
      });

      // Сохранить результат для команды /sources
      this.lastRagResult = ragResult;

      // Добавить в историю
      this.conversationManager.addTurn(question, ragResult);

      // Отобразить ответ
      this.displayAnswer(ragResult);
    } catch (error) {
      console.error(
        "❌ Ошибка при обработке вопроса:",
        (error as any).message
      );
    }
  }

  /**
   * Отобразить ответ с источниками
   */
  private displayAnswer(ragResult: any): void {
    console.log("─".repeat(80));
    console.log("\n📝 Assistant: " + ragResult.answer.trim() + "\n");

    // Показать источники если есть
    if (ragResult.sources.length > 0) {
      console.log("📚 ИСТОЧНИКИ:");
      ragResult.sources.forEach((source: any) => {
        console.log(`${source.id} ${source.file}`);
        console.log(`   Score: ${source.score.toFixed(4)}`);
        console.log(`   "${source.preview}"\n`);
      });
    }

    // Показать статус цитирования
    console.log("🔍 СТАТУС ЦИТИРОВАНИЯ:");
    console.log(
      `Найдено цитат: ${ragResult.foundCitations.join(", ") || "нет"}`
    );
    console.log(
      `Все источники процитированы: ${ragResult.hasAllCitations ? "✅ ДА" : "⚠️ НЕТ"}`
    );

    // Показать предупреждения о галлюцинациях
    if (ragResult.hallucinations.length > 0) {
      console.log("\n⚠️ ВОЗМОЖНЫЕ ГАЛЛЮЦИНАЦИИ:");
      ragResult.hallucinations.forEach((issue: string) => {
        console.log(issue);
      });
    }

    console.log("\n" + "─".repeat(80));
  }

  /**
   * Отобразить подробные источники
   */
  private async displaySources(ragResult: any): Promise<void> {
    console.log("\n📚 ПОДРОБНЫЕ ИСТОЧНИКИ:\n");

    if (ragResult.sources.length === 0) {
      console.log("Нет источников для отображения");
      return;
    }

    console.log(`Всего использовано источников: ${ragResult.sources.length}\n`);

    const allSources = this.conversationManager.getAllSources();
    console.log(`Уникальных источников в разговоре: ${allSources.length}\n`);

    allSources.forEach((source: any, index: number) => {
      console.log(`[${index + 1}] ${source.file} - ${source.chunkId}`);
      console.log(`    Score: ${source.score.toFixed(4)}`);
      console.log(`    "${source.preview}"\n`);
    });
  }

  /**
   * Экспортировать разговор
   */
  private handleExport(format: string): void {
    let filename = `conversation-${this.conversationManager.getId()}`;

    try {
      if (format === "json") {
        const content = this.conversationManager.exportAsJSON();
        const path = `data/${filename}.json`;
        require("fs").writeFileSync(path, content);
        console.log(`\n✅ Разговор экспортирован в ${path}`);
      } else {
        const content = this.conversationManager.exportAsText();
        const path = `data/${filename}.txt`;
        require("fs").writeFileSync(path, content);
        console.log(`\n✅ Разговор экспортирован в ${path}`);
      }
    } catch (error) {
      console.error(`\n❌ Ошибка при экспорте: ${(error as any).message}`);
    }
  }

  /**
   * Отобразить справку по командам
   */
  private displayHelp(): void {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║                    СПРАВКА ПО КОМАНДАМ                       ║
╚══════════════════════════════════════════════════════════════╝

📋 КОМАНДЫ:
  /help              - Показать эту справку
  /history           - Показать историю разговора
  /clear             - Очистить историю (начать заново)
  /sources           - Показать подробные источники
  /export [format]   - Экспортировать разговор (text или json)
  /exit, /quit       - Выйти из чатбота

💡 ПРИМЕРЫ:
  /export text       - Экспортировать как текстовый файл
  /export json       - Экспортировать как JSON

📝 ПРОСТО НАПИШИТЕ ВОПРОС:
  Введите любой вопрос о документах, и RAG найдет
  релевантную информацию с источниками.

─────────────────────────────────────────────────────────────────
    `);
  }

  /**
   * Завершить работу чатбота
   */
  private async exit(): Promise<void> {
    console.log("\n👋 До встречи! Спасибо за использование RAG-Чатбота.");
    console.log(
      `📊 Всего оборотов в разговоре: ${this.conversationManager.getTurnCount()}`
    );

    this.isRunning = false;
    this.rl.close();
    process.exit(0);
  }
}

/**
 * Точка входа
 */
async function main(): Promise<void> {
  const chatBot = new ChatBot();
  await chatBot.start();
}

main().catch((error) => {
  console.error("Критическая ошибка:", error);
  process.exit(1);
});
