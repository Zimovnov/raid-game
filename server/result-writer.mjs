import { Worker } from 'node:worker_threads';

export class ResultWriter {
  constructor(dbFile) {
    this.worker = new Worker(new URL('./result-worker.mjs', import.meta.url), { workerData: { dbFile } });
    this.pending = new Map();
    this.inflight = new Set();
    this.nextId = 0;
    this.exited = false;
    this.worker.on('message', packet => {
      const waiting = this.pending.get(packet.id);
      if (!waiting) return;
      this.pending.delete(packet.id);
      if (packet.error) waiting.reject(Error(packet.error)); else waiting.resolve(packet.profile);
    });
    this.worker.on('error', error => this.fail(error));
    this.worker.on('exit', code => this.fail(Error(`Поток сохранения остановился: ${code}`)));
  }

  fail(error) {
    this.exited = true;
    for (const waiting of this.pending.values()) waiting.reject(error);
    this.pending.clear();
  }

  commitResult(accountId, result) {
    if (this.exited) return Promise.reject(Error('Поток сохранения недоступен'));
    const id = ++this.nextId;
    const task = new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ type: 'commit', id, accountId, result });
    });
    this.inflight.add(task);
    void task.then(() => this.inflight.delete(task), () => this.inflight.delete(task));
    return task;
  }

  async close() {
    await Promise.allSettled([...this.inflight]);
    if (this.exited) return;
    await new Promise(resolve => {
      this.worker.once('exit', resolve);
      this.worker.postMessage({ type: 'close' });
    });
  }
}
