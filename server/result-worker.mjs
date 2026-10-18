import { parentPort, workerData } from 'node:worker_threads';
import { AccountStore } from './store.mjs';

const accounts = new AccountStore(workerData.dbFile, { recoverInterrupted: false });
parentPort.on('message', packet => {
  if (packet.type === 'close') { accounts.close(); parentPort.close(); return; }
  if (packet.type !== 'commit') return;
  try {
    const profile = accounts.commitResult(packet.accountId, packet.result);
    parentPort.postMessage({ id: packet.id, profile });
  } catch (error) {
    parentPort.postMessage({ id: packet.id, error: error instanceof Error ? error.message : 'Ошибка сохранения результата' });
  }
});
