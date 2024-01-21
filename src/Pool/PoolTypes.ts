import { Worker, TransferListItem } from 'node:worker_threads';

export enum WorkerEvent {
  WorkerMessage = 'workerMessage',
  WorkerError = 'workerError',
  BroadcasterMessageError = "broadcasterMessageError"
}

export enum PoolMode {
  Idle,
  Active,
  Cleared,
}

export type WorkerItem = {
  worker: Worker;
  available: boolean;
};

export type WorkerTask = {
  data: any;
  transfer: TransferListItem[];
};

export type PoolSettings = {
  file: string | URL;
  maxWorkers?: number;
  broadcasterId?: string;
};

export type RunWorker = (data: any, transfer?: TransferListItem[]) => void;

export type BroadcastMessage = (data: any) => void;

export type SetListener = (event: WorkerEvent, listener: (...args: any[]) => void) => void;

export type RemoveListener = (event: WorkerEvent, listener: (...args: any[]) => void) => void;

export type Clear = () => Promise<boolean>;

export type GetMode = () => PoolMode;

export interface IPool {
  runWorker: RunWorker;
  broadcastMessage: BroadcastMessage;
  setListener: SetListener;
  removeListener: RemoveListener;
  clear: Clear;
  getMode: GetMode;
}
