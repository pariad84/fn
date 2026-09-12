const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const TYPES = { '.html' : 'text/html', '.js' : 'text/javascript', '.json' : 'application/json' };

// fn ships as plain <script> tags with no build step, so the tests load it exactly the way a page
// does: over http, from the repo as it stands. Port 0 lets several test files run at once.
function serveRepo() {
    const server = http.createServer(function(req, res) {
        const file = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
        if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
            res.writeHead(404).end('not found');
            return;
        }
        res.writeHead(200, { 'Content-Type' : TYPES[path.extname(file)] || 'text/plain' });
        fs.createReadStream(file).pipe(res);
    });
    return new Promise(function(resolve) {
        server.listen(0, '127.0.0.1', function() { resolve(server); });
    });
}

const urlOf = (server) => `http://127.0.0.1:${server.address().port}`;

// One browser per test file, one blank page per test, with the requested scripts loaded in order.
function harness(files = ['fn.js']) {
    const state = {};

    const before = async () => {
        state.server = await serveRepo();
        state.browser = await chromium.launch();
    };

    // Defensive on both handles: if before() failed part-way, whatever did come up still has to be
    // torn down, or the open http server keeps the test process alive long after the run is over.
    const after = async () => {
        if (state.browser) {
            await state.browser.close();
        }
        if (state.server) {
            // close() alone waits on the keep-alive sockets the browser leaves open, which hangs.
            state.server.closeAllConnections();
            await new Promise(function(resolve) { state.server.close(resolve); });
        }
    };

    const page = async () => {
        const page = await state.browser.newPage();
        const errors = [];
        page.on('pageerror', function(error) { errors.push(String(error)); });
        await page.goto(`${urlOf(state.server)}/tests/blank.html`);
        for (const file of files) {
            await page.addScriptTag({ url : `${urlOf(state.server)}/${file}` });
        }
        await page.evaluate(function() { localStorage.clear(); });
        page.pageErrors = errors;
        return page;
    };

    return { before, after, page, state };
}

module.exports = { harness, serveRepo, urlOf };
