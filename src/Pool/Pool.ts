import { availableParallelism } from 'node:os';
import { EventEmitter } from 'node:events';
import { Worker } from 'node:worker_threads';
import { IPool, PoolSettings, RemoveListener, RunWorker, SetListener, WorkerEvent, WorkerItem, WorkerTask } from './PoolTypes.js';

export class Pool implements IPool {
  constructor(settings: PoolSettings) {
    const logicalCoresCount = availableParallelism();

    if (typeof settings.maxWorkers === 'number' && settings.maxWorkers > logicalCoresCount) {
      throw new Error(
        `Maximum number of workers must be less or equal to number of available logical cores.\r\nworkers: ${settings.maxWorkers}\r\nlogical cores: ${logicalCoresCount}`
      );
    }

    this.settings = settings;
    this.maxWorkers = settings.maxWorkers ?? logicalCoresCount;
  }

  private settings: PoolSettings;
  private maxWorkers: number;
  private workers: WorkerItem[] = [];
  private tasks: WorkerTask[] = [];
  private eventEmitter = new EventEmitter();

  private spawnWorker = () => {
    const workerItem = { worker: new Worker(this.settings.file), available: true };
    const { worker } = workerItem;

    worker.on('message', msg => {
      this.eventEmitter.emit(WorkerEvent.WorkerResult, msg);

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

  public setListener: SetListener = (event, listener) => {
    this.eventEmitter.addListener(event, listener);
  };

  public removeListener: RemoveListener = (event, listener) => {
    this.eventEmitter.removeListener(event, listener);
  };

  public clear = () => {
    for (const { worker } of this.workers) {
      worker.terminate();
    }

    this.workers = [];
  };
}

const pool = new Pool({ file: './out/workers/w.js', maxWorkers: availableParallelism() });

pool.runWorker('input msg');
