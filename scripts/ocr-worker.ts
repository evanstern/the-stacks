import { runOcrWorker } from "../app/lib/imports/ocr-worker.server.js";

runOcrWorker().catch((error) => {
  console.error("[ocr-worker] fatal", error);
  process.exitCode = 1;
});
