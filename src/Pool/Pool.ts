import { availableParallelism } from 'node:os';
import { EventEmitter } from 'node:events';
import { BroadcastChannel, Worker } from 'node:worker_threads';
import {
  BroadcastMessage,
  Clear,
  GetMode,
  IPool,
  PoolMode,
  PoolSettings,
  RemoveListener,
  RunWorker,
  SetListener,
  WorkerEvent,
  WorkerItem,
  WorkerTask,
} from './PoolTypes.js';

export class Pool implements IPool {
  constructor({ file, maxWorkers, broadcasterId }: PoolSettings) {
    const logicalCoresCount = availableParallelism();

    if (typeof maxWorkers === 'number' && maxWorkers > logicalCoresCount) {
      throw new Error(
        `Maximum number of workers must be less or equal to number of available logical cores.\r\nworkers: ${maxWorkers}\r\nlogical cores: ${logicalCoresCount}`
      );
    }

    this.file = file;
    this.maxWorkers = maxWorkers ?? logicalCoresCount;
    broadcasterId && (this.broadcaster = this.initBroadcaster(broadcasterId));
  }

  private file: string | URL;
  private maxWorkers: number;
  private workers: WorkerItem[] = [];
  private tasks: WorkerTask[] = [];
  private eventEmitter = new EventEmitter();
  private broadcaster: BroadcastChannel | undefined;
  private cleared = false;

  private initBroadcaster = (broadcasterId: string) => {
    const broadcaster = new BroadcastChannel(broadcasterId);

    broadcaster.onmessageerror = msg => {
      this.eventEmitter.emit(WorkerEvent.BroadcasterMessageError, msg);
    };

    return broadcaster;
  };

  private spawnWorker = () => {
    const workerItem = { worker: new Worker(this.file), available: true };
    const { worker } = workerItem;

    worker.on('message', msg => {
      this.eventEmitter.emit(WorkerEvent.WorkerMessage, msg);

      if (this.tasks.length > 0) {
        const task = this.tasks.shift();

        task && worker.postMessage(task.data, task.transfer);
      } else {
        workerItem.available = true;
      }
    });

    worker.on('exit', _exitCode => {
      this.workers = this.workers.filter(w => w === workerItem);
    });

    worker.on('error', err => {
      this.workers = this.workers.filter(w => w === workerItem);
      console.error(err);
      this.eventEmitter.emit(WorkerEvent.WorkerError, err);
    });

    worker.on('messageerror', err => {
      console.error(err);
      this.eventEmitter.emit(WorkerEvent.WorkerError, err);
      workerItem.available = true;
    });

    this.workers.push(workerItem);

    return workerItem;
  };

  public runWorker: RunWorker = (data, transfer = []) => {
    if (this.cleared) {
      throw new Error('Instance cleared and unusable.');
    }

    let availableWorker = this.workers.find(w => w.available);

    if (availableWorker === undefined && this.workers.length < this.maxWorkers) {
      availableWorker = this.spawnWorker();
    }

    if (availableWorker) {
      availableWorker.available = false;
      availableWorker.worker.postMessage(data, transfer);
    } else {
      this.tasks.push({ data, transfer });
    }
  };

  public broadcastMessage: BroadcastMessage = data => {
    this.broadcaster?.postMessage(data);
  };

  public setListener: SetListener = (event, listener) => {
    this.eventEmitter.addListener(event, listener);
  };

  public removeListener: RemoveListener = (event, listener) => {
    this.eventEmitter.removeListener(event, listener);
  };

  public clear: Clear = async () => {
    const mode = this.getMode();

    if (mode === PoolMode.Cleared) {
      console.log('Already cleared.');
      return false;
    }

    if (mode === PoolMode.Active) {
      console.log('Pending tasks.');
      return false;
    }

    await Promise.all(this.workers.map(({ worker }) => worker.terminate()));
    this.broadcaster?.close();
    this.eventEmitter.removeAllListeners();

    this.cleared = true;

    return true;
  };

  public getMode: GetMode = () => {
    if (this.cleared) return PoolMode.Cleared;

    if (this.workers.every(({ available }) => available)) {
      return PoolMode.Idle;
    } else {
      return PoolMode.Active;
    }
  };
}