import { AnswerWithSources } from "./ragPipeline";

/**
 * Один оборот разговора
 */
export interface Turn {
  userMessage: string;
  timestamp: Date;
  ragResult: AnswerWithSources;
  answerSummary: string;
}

/**
 * Состояние разговора
 */
export interface ConversationState {
  id: string;
  turns: Turn[];
  createdAt: Date;
  lastUpdated: Date;
}

/**
 * Менеджер разговора - управляет историей диалога
 */
export class ConversationManager {
  private state: ConversationState;

  constructor(id?: string) {
    this.state = {
      id: id || `chat-${Date.now()}`,
      turns: [],
      createdAt: new Date(),
      lastUpdated: new Date(),
    };
  }

  /**
   * Добавить новый оборот в разговор
   */
  addTurn(userMessage: string, ragResult: AnswerWithSources): void {
    const answerSummary = ragResult.answer
      .trim()
      .substring(0, 100)
      .replace(/\n/g, " ");

    const turn: Turn = {
      userMessage,
      timestamp: new Date(),
      ragResult,
      answerSummary,
    };

    this.state.turns.push(turn);
    this.state.lastUpdated = new Date();
  }

  /**
   * Получить полную историю разговора
   */
  getHistory(): Turn[] {
    return this.state.turns;
  }

  /**
   * Получить последние N оборотов для контекста
   */
  getContextWindow(size: number = 3): Turn[] {
    return this.state.turns.slice(Math.max(0, this.state.turns.length - size));
  }

  /**
   * Форматировать историю для добавления в промпт LLM
   * Формат: "Предыдущий разговор:\nПользователь: ...\nАссистент: ...\n..."
   */
  formatHistoryForPrompt(): string {
    if (this.state.turns.length === 0) {
      return "";
    }

    const contextWindow = this.getContextWindow(5); // Последние 5 оборотов для контекста
    let formattedHistory = "Предыдущий разговор:\n";

    contextWindow.forEach((turn) => {
      formattedHistory += `Пользователь: ${turn.userMessage}\n`;
      formattedHistory += `Ассистент: ${turn.answerSummary}\n\n`;
    });

    return formattedHistory;
  }

  /**
   * Форматировать историю для отображения пользователю
   */
  formatHistoryForDisplay(): string {
    if (this.state.turns.length === 0) {
      return "История разговора пуста.";
    }

    let output = `📜 История разговора (${this.state.turns.length} оборотов):\n`;
    output += "─".repeat(80) + "\n\n";

    this.state.turns.forEach((turn, index) => {
      const turnNumber = index + 1;
      const time = turn.timestamp.toLocaleTimeString("ru-RU");
      output += `[Обход ${turnNumber}] ${time}\n`;
      output += `Q: ${turn.userMessage}\n`;
      output += `A: ${turn.answerSummary}...\n`;
      output += `   Источники: ${turn.ragResult.sources.map((s) => s.id).join(", ") || "нет"}\n\n`;
    });

    output += "─".repeat(80);
    return output;
  }

  /**
   * Экспортировать разговор в JSON
   */
  exportAsJSON(): string {
    return JSON.stringify(this.state, null, 2);
  }

  /**
   * Экспортировать разговор в текстовый формат
   */
  exportAsText(): string {
    let output = `Разговор ID: ${this.state.id}\n`;
    output += `Начало: ${this.state.createdAt.toLocaleString("ru-RU")}\n`;
    output += `Последнее обновление: ${this.state.lastUpdated.toLocaleString("ru-RU")}\n`;
    output += "\n" + "=".repeat(80) + "\n\n";

    this.state.turns.forEach((turn, index) => {
      output += `--- Обход ${index + 1} ---\n`;
      output += `Время: ${turn.timestamp.toLocaleTimeString("ru-RU")}\n`;
      output += `Пользователь: ${turn.userMessage}\n`;
      output += `Ассистент: ${turn.ragResult.answer}\n`;
      output += `Источники:\n`;

      turn.ragResult.sources.forEach((source) => {
        output += `  ${source.id} ${source.file}: "${source.preview}"\n`;
      });

      output += "\n";
    });

    return output;
  }

  /**
   * Получить ID разговора
   */
  getId(): string {
    return this.state.id;
  }

  /**
   * Получить количество оборотов
   */
  getTurnCount(): number {
    return this.state.turns.length;
  }

  /**
   * Очистить историю (начать новый разговор)
   */
  clear(): void {
    this.state.turns = [];
    this.state.id = `chat-${Date.now()}`;
    this.state.createdAt = new Date();
    this.state.lastUpdated = new Date();
  }

  /**
   * Получить все использованные источники
   */
  getAllSources() {
    const sources = new Map<string, any>();

    this.state.turns.forEach((turn) => {
      turn.ragResult.sources.forEach((source) => {
        const key = `${source.file}::${source.chunkId}`;
        if (!sources.has(key)) {
          sources.set(key, source);
        }
      });
    });

    return Array.from(sources.values());
  }
}
