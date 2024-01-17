import { parentPort, threadId, workerData } from 'node:worker_threads';

console.log('w: ', workerData);

parentPort?.on("message", (x) => {
  parentPort?.postMessage(threadId);
  // computation logic
  
  console.log("w: ", x)
})

parentPort?.on("messageerror", (msg) => {
  console.error(`worker: w, thread: ${threadId}: ` , msg)
})
