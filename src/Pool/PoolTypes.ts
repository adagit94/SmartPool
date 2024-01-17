import { Worker, TransferListItem } from "node:worker_threads";

export enum WorkerEvent {
  WorkerResult = "workerResult",
  WorkerError = "workerError",
}

export type WorkerItem = {
  worker: Worker;
  available: boolean;
};

export type WorkerTask = {
  data: any;
  transfer: TransferListItem[]
};

export type PoolSettings = {
  file: string | URL;
  maxWorkers?: number;
};

export type RunWorker = (data: string, transfer?: TransferListItem[]) => unknown;

export type SetListener =  (event: WorkerEvent, listener: (...args: any[]) => void) => void

export type RemoveListener =  (event: WorkerEvent, listener: (...args: any[]) => void) => void 

export interface IPool {
  runWorker: RunWorker;
  setListener: SetListener
  removeListener: RemoveListener
}
