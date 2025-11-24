import { chunkText } from "./chunkText";
import { loadDocuments } from "./loadDocs";

const docs = loadDocuments();

for (const d of docs) {
  const chunks = chunkText(d.text, d.id, 40, 10); // маленькие чанки для теста
  console.log(d.id, "=>", chunks.length, "chunks");
  console.log(chunks.map((c) => c.text));
}
