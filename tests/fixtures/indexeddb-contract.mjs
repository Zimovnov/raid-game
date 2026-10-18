// Deterministic storage contract fixture. This is not a browser IndexedDB implementation.
// It models serialized transactions, clone-on-write, rollback, quota errors and exclusive locks.
export function storageFixture(t, initial = null) {
    let profile = initial === null ? undefined : structuredClone(initial), backups = [], active = null, held = false;
    const pending = [], connections = [], originals = new Map();
    const fixture = {
        failNextPut: false,
        throwOnPut: false,
        failNextBackup: false,
        openFailure: false,
        profile: () => profile === undefined ? undefined : structuredClone(profile),
        backups: () => structuredClone(backups),
        forceProfile: p => { profile = p === null ? undefined : structuredClone(p); },
        connections,
    };
    function install(key, value) {
        originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
        Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    }
    function advance() {
        if (active || !pending.length) return;
        active = pending.shift();
        active.start();
    }
    function transaction(connection, stores, mode = 'readonly') {
        if (connection.closed) throw Error('Connection closed');
        stores = Array.isArray(stores) ? stores : [stores];
        let state, archive, started = false, finished = false, scheduled = false;
        const requests = [];
        const tx = {
            error: null,
            objectStore(name) {
                if (!stores.includes(name)) throw Error('Store not in transaction');
                return {
                    get() { return request(() => state); },
                    put(value) {
                        if (fixture.throwOnPut) { fixture.throwOnPut = false; throw new DOMException('Cannot clone', 'DataCloneError'); }
                        const copy = structuredClone(value);
                        return request(() => {
                            if (fixture.failNextPut) { fixture.failNextPut = false; throw new DOMException('Quota reached', 'QuotaExceededError'); }
                            state = copy;
                        });
                    },
                    add(value) {
                        const copy = structuredClone(value);
                        return request(() => {
                            if (fixture.failNextBackup) { fixture.failNextBackup = false; throw new DOMException('Backup quota reached', 'QuotaExceededError'); }
                            archive.push(copy);
                        });
                    },
                };
            },
            abort() {
                if (finished) return;
                finished = true;
                queueMicrotask(() => { tx.onabort?.(); active = null; queueMicrotask(advance); });
            },
            start() {
                started = true;
                state = profile === undefined ? undefined : structuredClone(profile);
                archive = structuredClone(backups);
                schedule();
            },
        };
        function request(run) {
            if (finished) throw Error('Transaction inactive');
            const req = { result: undefined, error: null };
            requests.push({ run, req });
            schedule();
            return req;
        }
        function schedule() {
            if (!started || scheduled || finished) return;
            scheduled = true;
            queueMicrotask(() => {
                scheduled = false;
                if (finished) return;
                const operation = requests.shift();
                if (operation) {
                    try {
                        const value = operation.run();
                        operation.req.result = value === undefined ? undefined : structuredClone(value);
                        operation.req.onsuccess?.();
                    } catch (error) {
                        tx.error = error; operation.req.error = error;
                        operation.req.onerror?.(); tx.onerror?.(); tx.abort();
                    }
                    schedule();
                } else {
                    finished = true;
                    if (mode === 'readwrite') { profile = state; backups = archive; }
                    tx.oncomplete?.(); active = null; queueMicrotask(advance);
                }
            });
        }
        pending.push(tx); queueMicrotask(advance);
        return tx;
    }
    install('navigator', { locks: { async request(name, _options, callback) {
        if (held) return callback(null);
        held = true;
        try { return await callback({ name }); } finally { held = false; }
    } } });
    install('indexedDB', { open() {
        const req = { result: null, error: null };
        queueMicrotask(() => {
            if (fixture.openFailure) {
                req.error = new DOMException('Storage denied', 'InvalidStateError'); req.onerror?.(); return;
            }
            const connection = { closed: false, close() { this.closed = true; }, transaction(stores, mode) { return transaction(this, stores, mode); } };
            connections.push(connection); req.result = connection; req.onsuccess?.();
        });
        return req;
    } });
    t.after(() => {
        for (const [key, descriptor] of originals) {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor);
            else delete globalThis[key];
        }
    });
    return fixture;
}
