const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { harness } = require('./helpers');

// admin.html is the deliverable the two repos exist for, and it talks to a hardcoded
// http://localhost:3000/api. Intercepting that in the browser lets the page be tested exactly as
// it ships -- no test-only configuration hook in the page, and no server repo needed here. What
// the interception answers is the contract in tests/contract.js, which the server repo is held to.
const DEFINITIONS = [
    { key : 'task', label : 'Tasks', fields : [
        { name : 'title', label : 'Title', required : true, form : { type : 'text' } },
        { name : 'status', label : 'Status', form : { type : 'select', datas : [
            { value : 'todo', label : 'To do' }, { value : 'done', label : 'Done' } ] } },
    ] },
];

async function console_(page, seed = [], reject) {
    const rows = seed.map(function(data, index) { return { id : index + 1, data : data }; });
    const state = { rows, deleted : [] };

    await page.route('**/api/**', async function(route) {
        const request = route.request();
        const url = new URL(request.url());
        const json = (status, body) => route.fulfill({
            status,
            contentType : 'application/json',
            headers : { 'Access-Control-Allow-Origin' : '*', 'Access-Control-Allow-Methods' : 'GET, POST, PUT, DELETE, OPTIONS', 'Access-Control-Allow-Headers' : 'Content-Type' },
            body : JSON.stringify(body),
        });

        if (request.method() === 'OPTIONS') {
            return json(204, {});
        }
        if (url.pathname === '/api/resources') {
            return json(200, DEFINITIONS);
        }
        const match = url.pathname.match(/^\/api\/data\/([^/]+)(?:\/(\d+))?$/);
        if (!match) {
            return json(404, { message : 'not found' });
        }
        if (request.method() === 'GET') {
            return json(200, state.rows);
        }
        if (request.method() === 'POST') {
            const body = request.postDataJSON();
            if (!body.data.title) {
                return json(400, { message : 'Title is required' });
            }
            const row = { id : state.rows.length + 1, data : body.data };
            state.rows.push(row);
            return json(201, row);
        }
        if (request.method() === 'DELETE') {
            if (reject) {
                return json(400, { message : reject });
            }
            state.deleted.push(Number(match[2]));
            state.rows = state.rows.filter(function(row) { return row.id !== Number(match[2]); });
            return json(200, { id : Number(match[2]), data : {} });
        }
        return json(200, { id : Number(match[2]), data : request.postDataJSON().data });
    });

    await page.goto(page.url().replace('/tests/blank.html', '/admin.html'));
    await page.waitForSelector('#app button');
    return state;
}

const openList = async (page) => {
    await page.getByRole('button', { name : 'Tasks' }).click();
    await page.waitForSelector('.__popup table');
};

const fn = harness([]);

describe('admin.html', function() {
    before(fn.before);
    after(fn.after);

    it('builds its buttons from the definitions the server serves', async function() {
        const page = await fn.page();
        await console_(page);
        assert.deepEqual(await page.locator('#app button').allTextContents(), ['Tasks']);
    });

    it('takes its columns and its options from the definition, not from the page', async function() {
        const page = await fn.page();
        await console_(page, [{ title : 'one', status : 'done' }]);
        await openList(page);
        assert.deepEqual(await page.locator('.__popup thead th').allTextContents(), ['Title', 'Status']);
        // 'done' is stored; 'Done' is what the definition says to show.
        assert.deepEqual(await page.locator('.__popup tbody td').allTextContents(), ['one', 'Done']);
    });

    it('shows a refused write beside the form, keeping the popup open', async function() {
        const page = await fn.page();
        const state = await console_(page);
        await openList(page);
        await page.locator('button[title="New item"]').click();
        await page.waitForSelector('.__popup:last-child .__form');
        await page.locator('.__popup').last().locator('button[title="Save"]').click();
        await page.waitForSelector('.__popup:last-child .__error');
        assert.equal(await page.locator('.__popup').last().locator('.__error').textContent(), 'Title is required');
        assert.ok(await page.locator('.__popup').last().locator('.__form').isVisible());
        assert.equal(state.rows.length, 0);
    });

    describe('deleting asks first', function() {
        const openDelete = async (page) => {
            await openList(page);
            await page.locator('.__popup tbody tr').first().click();
            await page.waitForSelector('.__popup:last-child .__form');
            await page.locator('.__popup').last().locator('button[title="Delete"]').click();
            await page.waitForSelector('.__popup:last-child button[title="Cancel"]');
        };

        it('asks before deleting rather than acting on the click', async function() {
            const page = await fn.page();
            const state = await console_(page, [{ title : 'one' }]);
            await openDelete(page);
            assert.match(await page.locator('.__popup').last().textContent(), /no undo/);
            assert.deepEqual(state.deleted, [], 'nothing was deleted just by asking');
        });

        it('cancelling leaves the row alone and the edit popup open', async function() {
            const page = await fn.page();
            const state = await console_(page, [{ title : 'one' }]);
            await openDelete(page);
            await page.locator('.__popup').last().locator('button[title="Cancel"]').click();
            assert.deepEqual(state.deleted, []);
            assert.equal(await page.locator('.__popup tbody tr').count(), 1);
            assert.ok(await page.locator('.__popup .__form').isVisible(), 'the edit popup is still there');
        });

        it('confirming deletes the row and closes back to the list', async function() {
            const page = await fn.page();
            const state = await console_(page, [{ title : 'one' }]);
            await openDelete(page);
            await page.locator('.__popup').last().locator('button[title="Delete"]').click();
            await page.waitForFunction(function() { return document.querySelectorAll('.__popup tbody tr').length === 0; });
            assert.deepEqual(state.deleted, [1]);
            assert.equal(await page.locator('.__popup .__form').count(), 0, 'the edit popup closed');
        });

        it('a refused delete reports itself and leaves the row', async function() {
            const page = await fn.page();
            const state = await console_(page, [{ title : 'one' }], 'Not allowed');
            await openDelete(page);
            await page.locator('.__popup').last().locator('button[title="Delete"]').click();
            await page.waitForSelector('.__error');
            assert.equal(await page.locator('.__error').textContent(), 'Not allowed');
            assert.equal(await page.locator('.__popup tbody tr').count(), 1);
            assert.deepEqual(state.deleted, []);
        });
    });
});
