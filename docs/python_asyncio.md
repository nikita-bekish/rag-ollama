# Python asyncio - Асинхронное программирование

## Введение

`asyncio` — это библиотека Python для написания асинхронного кода с использованием синтаксиса async/await. Она предоставляет основу для написания однопоточного асинхронного кода в Python 3.7 и выше.

### Основные компоненты

**Event Loop** — это сердце asyncio. Он управляет выполнением асинхронных задач. Каждое приложение может иметь только один event loop на один поток.

**Coroutine** — это функция, определённая с использованием async def. Она может использовать ключевое слово await для приостановки выполнения и ожидания завершения других корутин.

**Task** — это объект, который обёртывает корутину и управляет её выполнением в event loop.

**Future** — это объект низкого уровня, который представляет результат асинхронной операции, которая может быть или не быть доступна в настоящее время.

## Основной синтаксис

### Создание корутины

```python
async def hello():
    print("Hello")
    await asyncio.sleep(1)
    print("World")
```

### Запуск корутины

```python
import asyncio

async def main():
    await hello()

asyncio.run(main())
```

Функция `asyncio.run()` была добавлена в Python 3.7. Она создаёт новый event loop, запускает корутину и закрывает loop.

## Параллельное выполнение

### Использование gather()

Функция `asyncio.gather()` позволяет запустить несколько корутин одновременно:

```python
async def fetch_data(url):
    # Имитируем получение данных
    await asyncio.sleep(1)
    return f"Data from {url}"

async def main():
    urls = ["http://example.com/1", "http://example.com/2", "http://example.com/3"]
    results = await asyncio.gather(*[fetch_data(url) for url in urls])
    print(results)
```

### Использование create_task()

`create_task()` позволяет создать задачу, которая будет выполняться в фоне:

```python
async def main():
    task1 = asyncio.create_task(fetch_data("http://example.com/1"))
    task2 = asyncio.create_task(fetch_data("http://example.com/2"))

    result1 = await task1
    result2 = await task2
    print(result1, result2)
```

## Обработка исключений

### Try/Except в корутинах

```python
async def main():
    try:
        result = await asyncio.wait_for(some_coroutine(), timeout=5)
    except asyncio.TimeoutError:
        print("Операция истекла по времени")
```

### Получение результата и исключения из задачи

```python
task = asyncio.create_task(some_coroutine())
try:
    result = await task
except Exception as e:
    print(f"Задача вызвала исключение: {e}")
```

## Timeout

Функция `asyncio.wait_for()` устанавливает timeout для корутины:

```python
async def main():
    try:
        result = await asyncio.wait_for(long_operation(), timeout=10)
    except asyncio.TimeoutError:
        print("Операция превысила 10 секунд")
```

Если timeout истекает, выбрасывается `asyncio.TimeoutError`.

## Порядок выполнения

Важно понимать, что asyncio НЕ даёт истинный параллелизм на многих ядрах. Это кооперативная многозадачность. Event loop выполняет одну корутину в момент времени, переключаясь между ними при встрече с `await`.

Пример:

```python
async def task(name, delay):
    print(f"Task {name} started")
    await asyncio.sleep(delay)
    print(f"Task {name} finished")

async def main():
    # Эти задачи будут выполняться параллельно (но не одновременно)
    await asyncio.gather(
        task("A", 2),
        task("B", 1),
        task("C", 3)
    )

# Выход:
# Task A started
# Task B started
# Task C started
# Task B finished
# Task A finished
# Task C finished
```

Общее время выполнения: 3 секунды (максимум из всех задач), а не 2+1+3=6 секунд.

## Производительность

asyncio идеален для операций, связанных с вводом-выводом (I/O-bound), таких как:
- Сетевые запросы
- Чтение файлов с диска
- Запросы к базам данных

asyncio НЕ подходит для операций, связанных с процессором (CPU-bound), так как он работает в одном потоке.

Для CPU-bound операций используйте `multiprocessing` или `concurrent.futures.ProcessPoolExecutor`.

## Версии Python

- asyncio впервые был добавлен в Python 3.4
- Синтаксис async/await был добавлен в Python 3.5
- Функция `asyncio.run()` была добавлена в Python 3.7
- Множество улучшений были добавлены в Python 3.10 и 3.11

## Лучшие практики

1. **Всегда используйте asyncio.run()** для запуска главной корутины в Python 3.7+
2. **Используйте asyncio.gather()** для выполнения нескольких корутин параллельно
3. **Избегайте блокирующих операций** внутри async функций
4. **Используйте asyncio.wait_for()** для установки timeout
5. **Обрабатывайте исключения** правильно с try/except

## Заключение

asyncio — это мощная библиотека для асинхронного программирования в Python. Она позволяет писать быстрый и отзывчивый код для операций, связанных с вводом-выводом. Понимание event loop, корутин и правильное использование await — ключ к успеху.
