const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { harness } = require('./helpers');

const fn = harness(['fn.js']);

describe('fn.data (localStorage backing)', function() {
    before(fn.before);
    after(fn.after);

    it('insert assigns ids from 1 and returns the row', async function() {
        const page = await fn.page();
        assert.deepEqual(await page.evaluate(function() {
            return [
                fn.data.insert({ key : 'k', data : { a : 1 } }),
                fn.data.insert({ key : 'k', data : { a : 2 } }),
            ];
        }), [{ id : 1, data : { a : 1 } }, { id : 2, data : { a : 2 } }]);
    });

    it('insert never reuses the id of a deleted row',
        { todo : 'the next id is max(id) + 1 over the rows that remain, so deleting the last row hands its id to the next insert -- an edit popup still open on the old row then overwrites the new one. The server backing, on a database sequence, never reuses.' },
        async function() {
            const page = await fn.page();
            assert.deepEqual(await page.evaluate(function() {
                fn.data.insert({ key : 'k', data : { name : 'first' } });
                const second = fn.data.insert({ key : 'k', data : { name : 'second' } });
                fn.data.delete({ key : 'k', id : second.id });
                const third = fn.data.insert({ key : 'k', data : { name : 'third' } });
                return { reused : third.id === second.id, id : third.id };
            }), { reused : false, id : 3 });
        });

    it('select answers an empty array for a key never written', async function() {
        const page = await fn.page();
        assert.deepEqual(await page.evaluate(function() {
            return fn.data.select({ key : 'nothing' });
        }), []);
    });

    it('select returns every row, select by id returns one', async function() {
        const page = await fn.page();
        assert.deepEqual(await page.evaluate(function() {
            fn.data.insert({ key : 'k', data : { a : 1 } });
            fn.data.insert({ key : 'k', data : { a : 2 } });
            return [fn.data.select({ key : 'k' }).length, fn.data.select({ key : 'k', id : 2 }).data];
        }), [2, { a : 2 }]);
    });

    it('select by an id that is not there answers undefined', async function() {
        const page = await fn.page();
        assert.equal(await page.evaluate(function() {
            fn.data.insert({ key : 'k', data : {} });
            return fn.data.select({ key : 'k', id : 99 });
        }), undefined);
    });

    it('keys are independent of each other', async function() {
        const page = await fn.page();
        assert.deepEqual(await page.evaluate(function() {
            fn.data.insert({ key : 'a', data : {} });
            return [fn.data.select({ key : 'a' }).length, fn.data.select({ key : 'b' }).length];
        }), [1, 0]);
    });

    it('update replaces the row data and returns the row', async function() {
        const page = await fn.page();
        assert.deepEqual(await page.evaluate(function() {
            fn.data.insert({ key : 'k', data : { a : 1 } });
            const returned = fn.data.update({ key : 'k', id : 1, data : { a : 9 } });
            return [returned, fn.data.select({ key : 'k', id : 1 }).data];
        }), [{ id : 1, data : { a : 9 } }, { a : 9 }]);
    });

    it('update of an id that is not there answers undefined and writes nothing', async function() {
        const page = await fn.page();
        assert.deepEqual(await page.evaluate(function() {
            fn.data.insert({ key : 'k', data : { a : 1 } });
            const before = localStorage.getItem('k');
            const returned = fn.data.update({ key : 'k', id : 99, data : { a : 9 } });
            return [returned, localStorage.getItem('k') === before];
        }), [undefined, true]);
    });

    it('delete removes the row and returns it', async function() {
        const page = await fn.page();
        assert.deepEqual(await page.evaluate(function() {
            fn.data.insert({ key : 'k', data : { a : 1 } });
            return [fn.data.delete({ key : 'k', id : 1 }), fn.data.select({ key : 'k' })];
        }), [{ id : 1, data : { a : 1 } }, []]);
    });

    it('survives a reload -- rows are in storage, not in memory', async function() {
        const page = await fn.page();
        await page.evaluate(function() { fn.data.insert({ key : 'k', data : { a : 1 } }); });
        await page.reload();
        await page.addScriptTag({ url : page.url().replace('/tests/blank.html', '/fn.js') });
        assert.equal(await page.evaluate(function() {
            return fn.data.select({ key : 'k' }).length;
        }), 1);
    });

    // --- Defects. All three are in fn.data._.read/_.write -- the one block the README says is all
    // you rewrite to swap the storage layer, and the only place in fn.js with any defensive code.

    it('delete of an id that is not there writes nothing',
        { todo : 'rewrites the key regardless, where update only writes when it found the row' },
        async function() {
            const page = await fn.page();
            assert.equal(await page.evaluate(function() {
                fn.data.insert({ key : 'k', data : { a : 1 } });
                var writes = 0;
                const setItem = Storage.prototype.setItem;
                Storage.prototype.setItem = function() { writes += 1; return setItem.apply(this, arguments); };
                fn.data.delete({ key : 'k', id : 99 });
                Storage.prototype.setItem = setItem;
                return writes;
            }), 0);
        });

    it('a corrupt value does not take the page down',
        { todo : 'JSON.parse is unguarded, so one bad key throws out of every select on the page' },
        async function() {
            const page = await fn.page();
            const result = await page.evaluate(function() {
                localStorage.setItem('k', 'not json');
                try {
                    return { rows : fn.data.select({ key : 'k' }) };
                } catch (error) {
                    return { threw : error.name };
                }
            });
            assert.deepEqual(result, { rows : [] }, `select threw ${result.threw}`);
        });

    it('storage the browser refuses does not throw out of fn.data',
        { todo : 'typeof(Storage) only proves the constructor exists; access still throws SecurityError when site data is blocked' },
        async function() {
            const page = await fn.page();
            const result = await page.evaluate(function() {
                // What a blocked origin actually does: Storage stays defined, access throws.
                const getItem = Storage.prototype.getItem;
                Storage.prototype.getItem = function() { throw new DOMException('denied', 'SecurityError'); };
                try {
                    return { storageDefined : typeof Storage, rows : fn.data.select({ key : 'k' }) };
                } catch (error) {
                    return { storageDefined : typeof Storage, threw : error.name };
                } finally {
                    Storage.prototype.getItem = getItem;
                }
            });
            assert.deepEqual(result, { storageDefined : 'function', rows : [] });
        });

    it('a failed write reaches the caller through the Promise.resolve convention',
        { todo : 'the write throws synchronously, so it escapes Promise.resolve(...).then(ok, fail) -- the two storage layers do not behave alike on error, contrary to the README' },
        async function() {
            const page = await fn.page();
            const outcome = await page.evaluate(async function() {
                const setItem = Storage.prototype.setItem;
                Storage.prototype.setItem = function() { throw new DOMException('full', 'QuotaExceededError'); };
                try {
                    return await new Promise(function(resolve) {
                        try {
                            Promise.resolve(fn.data.insert({ key : 'k', data : { a : 1 } })).then(
                                function() { resolve('resolved'); },
                                function() { resolve('rejected -- the caller can show it'); });
                        } catch (error) {
                            resolve('threw past the promise: ' + error.name);
                        }
                    });
                } finally {
                    Storage.prototype.setItem = setItem;
                }
            });
            assert.equal(outcome, 'rejected -- the caller can show it');
        });
});
