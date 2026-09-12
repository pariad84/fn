const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const { harness } = require('./helpers');
const { CALLS } = require('./contract');

const fn = harness(['fn.js']);

// A stub standing in for server's /api/data/:resource. It records what fn asked for and answers
// whatever the test queued, so these tests pin fn's half of the contract with no server present.
function stub() {
    const state = { seen : [], preflights : 0, reply : { status : 200, body : [] } };
    const server = http.createServer(function(req, res) {
        // A JSON body makes the browser preflight every write, so the real server answers OPTIONS
        // and so does this. It is transport, not one of the calls, so it is counted separately.
        if (req.method === 'OPTIONS') {
            state.preflights += 1;
            res.writeHead(204, {
                'Access-Control-Allow-Origin' : '*',
                'Access-Control-Allow-Methods' : 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers' : 'Content-Type',
            }).end();
            return;
        }
        let raw = '';
        req.on('data', function(chunk) { raw += chunk; });
        req.on('end', function() {
            state.seen.push({ method : req.method, path : req.url, body : raw ? JSON.parse(raw) : undefined });
            res.writeHead(state.reply.status, {
                'Content-Type' : 'application/json',
                'Access-Control-Allow-Origin' : '*',
                'Access-Control-Allow-Methods' : 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers' : 'Content-Type',
            });
            res.end(JSON.stringify(state.reply.body));
        });
    });
    return new Promise(function(resolve) {
        server.listen(0, '127.0.0.1', function() {
            state.url = `http://127.0.0.1:${server.address().port}`;
            state.close = function() {
                server.closeAllConnections();
                return new Promise(function(done) { server.close(done); });
            };
            resolve(state);
        });
    });
}

const withRemote = async (api) => {
    const page = await fn.page();
    await page.addScriptTag({ url : page.url().replace('/tests/blank.html', '/fn.data.remote.js') });
    await page.evaluate(function(url) { fn.data.remote.url = url; }, api.url);
    return page;
};

describe('fn.data.remote', function() {
    before(fn.before);
    after(fn.after);

    for (const expected of CALLS) {
        it(`${expected.call} sends ${expected.method} ${expected.path}`, async function() {
            const api = await stub();
            try {
                const page = await withRemote(api);
                api.reply = { status : expected.method === 'POST' ? 201 : 200, body : { id : 7, data : {} } };
                await page.evaluate(function(spec) {
                    return fn.data[spec.call](spec.opt);
                }, { call : expected.call, opt : expected.opt });
                assert.deepEqual(api.seen, [{ method : expected.method, path : expected.path, body : expected.body }]);
            } finally {
                await api.close();
            }
        });
    }

    it('a write is preflighted, so the server has to answer OPTIONS', async function() {
        const api = await stub();
        try {
            const page = await withRemote(api);
            api.reply = { status : 201, body : { id : 1, data : {} } };
            await page.evaluate(function() { return fn.data.insert({ key : 'item', data : { a : 1 } }); });
            assert.equal(api.preflights, 1);
        } finally {
            await api.close();
        }
    });

    it('every call answers with a promise, whatever the backing', async function() {
        const api = await stub();
        try {
            const page = await withRemote(api);
            assert.deepEqual(await page.evaluate(function() {
                return ['select', 'insert', 'update', 'delete'].map(function(name) {
                    return fn.data[name]({ key : 'item', id : 1, data : {} }) instanceof Promise;
                });
            }), [true, true, true, true]);
        } finally {
            await api.close();
        }
    });

    it('select resolves to the rows the server sent', async function() {
        const api = await stub();
        try {
            const page = await withRemote(api);
            api.reply = { status : 200, body : [{ id : 1, data : { a : 1 } }] };
            assert.deepEqual(await page.evaluate(function() {
                return fn.data.select({ key : 'item' });
            }), [{ id : 1, data : { a : 1 } }]);
        } finally {
            await api.close();
        }
    });

    it('a 404 resolves to undefined, the same answer the localStorage backing gives', async function() {
        const api = await stub();
        try {
            const page = await withRemote(api);
            api.reply = { status : 404, body : { message : 'Record not found' } };
            assert.equal(await page.evaluate(function() {
                return fn.data.select({ key : 'item', id : 99 }).then(function(row) {
                    return row === undefined ? 'undefined' : JSON.stringify(row);
                });
            }), 'undefined');
        } finally {
            await api.close();
        }
    });

    it('a 400 rejects carrying the server message, so a page can show it', async function() {
        const api = await stub();
        try {
            const page = await withRemote(api);
            api.reply = { status : 400, body : { message : 'Title is required' } };
            assert.equal(await page.evaluate(function() {
                return fn.data.insert({ key : 'item', data : {} }).then(
                    function() { return 'resolved'; },
                    function(error) { return error.message; });
            }), 'Title is required');
        } finally {
            await api.close();
        }
    });

    it('escapes a key and id that need it', async function() {
        const api = await stub();
        try {
            const page = await withRemote(api);
            await page.evaluate(function() { return fn.data.select({ key : 'odd key/x', id : 'a b' }); });
            assert.equal(api.seen[0].path, '/odd%20key%2Fx/a%20b');
        } finally {
            await api.close();
        }
    });

    it('replaces fn.data without touching anything else in fn', async function() {
        const api = await stub();
        try {
            const page = await withRemote(api);
            assert.deepEqual(await page.evaluate(function() {
                return {
                    element : typeof fn.element.create,
                    component : typeof fn.component.create,
                    data : ['select', 'insert', 'update', 'delete'].map(function(k) { return typeof fn.data[k]; }),
                };
            }), { element : 'function', component : 'function', data : ['function', 'function', 'function', 'function'] });
        } finally {
            await api.close();
        }
    });
});
