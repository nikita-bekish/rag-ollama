import { getEmbedding } from "./embeddings";

(async () => {
  const vec = await getEmbedding("Привет, как дела?");
  console.log("Embedding размер:", vec.length);
  console.log(vec.slice(0, 10)); // первые 10 чисел
})();
