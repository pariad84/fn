const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { harness } = require('./helpers');

const fn = harness(['fn.js', 'fn.util.js', 'fn.layout.js']);

// The fields a form/list is driven by are pure data -- the same shape server serves from
// /api/resources. Keeping a copy here is what lets fn be tested with no server in sight.
const FIELDS = `[
    { name : 'text',   label : 'Text',   form : { type : 'text' } },
    { name : 'choice', label : 'Choice', form : { type : 'select', datas : [
        { value : 'a', label : 'Apple' }, { value : 'b', label : 'Banana' } ] } },
    { name : 'pick',   label : 'Pick',   form : { type : 'radio', datas : [
        { value : 'x', label : 'Ex' }, { value : 'y', label : 'Why' } ] } },
    { name : 'count',  label : 'Count',  form : { type : 'number' } },
    { name : 'odd',    label : 'Odd',    form : { type : 'no-such-type' } }
]`;

describe('fn.layout form', function() {
    before(fn.before);
    after(fn.after);

    it('renders one labelled input per field, dispatching on form.type', async function() {
        const page = await fn.page();
        assert.deepEqual(await page.evaluate(new Function(`
            const form = fn.component.create({ name : 'form', fields : ${FIELDS}, data : {} });
            return {
                // :scope > label -- the radio layout gives each of its own options a label too.
                labels : Array.from(form.querySelectorAll(':scope > label')).map(function(l) { return l.textContent; }),
                select : !!form.querySelector('select[name="choice"]'),
                radios : form.querySelectorAll('input[type="radio"][name="pick"]').length,
                number : form.querySelector('input[name="count"]').type,
            };
        `)), {
            labels : ['Text', 'Choice', 'Pick', 'Count', 'Odd'],
            select : true,
            radios : 2,
            number : 'number',
        });
    });

    it('falls back to the input layout for a type with none of its own', async function() {
        const page = await fn.page();
        assert.equal(await page.evaluate(new Function(`
            const form = fn.component.create({ name : 'form', fields : ${FIELDS}, data : {} });
            return form.querySelector('[name="odd"]').tagName;
        `)), 'INPUT');
    });

    it('save() collects the current value of every field', async function() {
        const page = await fn.page();
        assert.deepEqual(await page.evaluate(new Function(`
            const form = fn.component.create({ name : 'form', fields : ${FIELDS}, data : {} });
            document.body.appendChild(form);
            form.querySelector('[name="text"]').value = 'typed';
            form.querySelector('select[name="choice"]').value = 'b';
            form.querySelector('input[name="pick"][value="y"]').checked = true;
            return form.save();
        `)), { text : 'typed', choice : 'b', pick : 'y', count : '', odd : '' });
    });

    it('prefills from opt.data, select and radio included', async function() {
        const page = await fn.page();
        assert.deepEqual(await page.evaluate(new Function(`
            const form = fn.component.create({ name : 'form', fields : ${FIELDS},
                data : { text : 'hi', choice : 'b', pick : 'y' } });
            return [
                form.querySelector('[name="text"]').value,
                form.querySelector('select[name="choice"]').value,
                form.querySelector('input[name="pick"]:checked').value,
            ];
        `)), ['hi', 'b', 'y']);
    });

    it('save() reports an unanswered radio group as undefined', async function() {
        const page = await fn.page();
        assert.equal(await page.evaluate(new Function(`
            const form = fn.component.create({ name : 'form', fields : ${FIELDS}, data : {} });
            return form.save().pick;
        `)), undefined);
    });
});

describe('fn.layout list', function() {
    before(fn.before);
    after(fn.after);

    it('renders a header per field', async function() {
        const page = await fn.page();
        assert.deepEqual(await page.evaluate(new Function(`
            const list = fn.component.create({ name : 'list', fields : ${FIELDS},
                select : function() { return []; }, click : function() {} });
            return Array.from(list.querySelectorAll('th')).map(function(th) { return th.textContent; });
        `)), ['Text', 'Choice', 'Pick', 'Count', 'Odd']);
    });

    it('shows the option label for a value, not the value', async function() {
        const page = await fn.page();
        assert.deepEqual(await page.evaluate(new Function(`
            const list = fn.component.create({ name : 'list', fields : ${FIELDS},
                select : function() { return [{ id : 1, text : 't', choice : 'b', pick : 'x', count : 0, odd : '' }]; },
                click : function() {} });
            return list.refresh().then(function() {
                return Array.from(list.querySelectorAll('tbody td')).map(function(td) { return td.textContent; });
            });
        `)), ['t', 'Banana', 'Ex', '0', '']);
    });

    it('falls back to the stored value when no option matches', async function() {
        const page = await fn.page();
        assert.equal(await page.evaluate(new Function(`
            const list = fn.component.create({ name : 'list', fields : ${FIELDS},
                select : function() { return [{ id : 1, choice : 'retired' }]; }, click : function() {} });
            return list.refresh().then(function() {
                return list.querySelectorAll('tbody td')[1].textContent;
            });
        `)), 'retired');
    });

    it('refresh waits on a promised select', async function() {
        const page = await fn.page();
        assert.equal(await page.evaluate(new Function(`
            const list = fn.component.create({ name : 'list', fields : ${FIELDS},
                select : function() {
                    return new Promise(function(resolve) {
                        setTimeout(function() { resolve([{ id : 1, text : 'late' }]); }, 20);
                    });
                }, click : function() {} });
            return list.refresh().then(function() {
                return list.querySelector('tbody td').textContent;
            });
        `)), 'late');
    });

    it('leaves the rows in place when select rejects', async function() {
        const page = await fn.page();
        assert.equal(await page.evaluate(new Function(`
            var fail = false;
            const list = fn.component.create({ name : 'list', fields : ${FIELDS},
                select : function() {
                    return fail ? Promise.reject(new Error('offline')) : [{ id : 1, text : 'kept' }];
                }, click : function() {} });
            return list.refresh().then(function() {
                fail = true;
                return list.refresh().catch(function() {});
            }).then(function() {
                return list.querySelector('tbody td').textContent;
            });
        `)), 'kept');
    });

    it('a row click hands back { item, list }', async function() {
        const page = await fn.page();
        assert.deepEqual(await page.evaluate(new Function(`
            var got;
            const list = fn.component.create({ name : 'list', fields : ${FIELDS},
                select : function() { return [{ id : 7, text : 'row' }]; },
                click : function(opt) { got = opt; } });
            return list.refresh().then(function() {
                list.querySelector('tbody tr').click();
                return { id : got.item.id, sameList : got.list === list };
            });
        `)), { id : 7, sameList : true });
    });
});

describe('fn.layout confirm', function() {
    before(fn.before);
    after(fn.after);

    const open = `
        var confirmed = 0;
        fn.component.create({
            name : 'confirm', title : 'Delete', text : 'Delete this item? There is no undo.',
            label : 'Delete', parent : document.body,
            confirm : function() { confirmed += 1; },
        });
    `;

    it('shows the question and both ways out', async function() {
        const page = await fn.page();
        assert.deepEqual(await page.evaluate(new Function(`
            ${open}
            const popup = document.querySelector('.__popup');
            return {
                title : popup.firstElementChild.firstElementChild.textContent,
                text : popup.textContent.indexOf('There is no undo.') !== -1,
                buttons : Array.from(popup.querySelectorAll('button')).map(function(b) { return b.textContent; }),
            };
        `)), { title : 'Delete', text : true, buttons : ['❌', 'Cancel', 'Delete'] });
    });

    it('confirming runs the hook once and closes', async function() {
        const page = await fn.page();
        assert.deepEqual(await page.evaluate(new Function(`
            ${open}
            document.querySelector('.__popup button[title="Delete"]').click();
            return { confirmed : confirmed, open : document.querySelectorAll('.__popup').length };
        `)), { confirmed : 1, open : 0 });
    });

    it('cancelling closes and runs nothing', async function() {
        const page = await fn.page();
        assert.deepEqual(await page.evaluate(new Function(`
            ${open}
            document.querySelector('.__popup button[title="Cancel"]').click();
            return { confirmed : confirmed, open : document.querySelectorAll('.__popup').length };
        `)), { confirmed : 0, open : 0 });
    });

    it('the header close is a cancel too, not a silent confirm', async function() {
        const page = await fn.page();
        assert.deepEqual(await page.evaluate(new Function(`
            ${open}
            document.querySelector('.__popup button[title="Close"]').click();
            return { confirmed : confirmed, open : document.querySelectorAll('.__popup').length };
        `)), { confirmed : 0, open : 0 });
    });

    it('opens above the popup that raised it, which stays open behind', async function() {
        const page = await fn.page();
        assert.deepEqual(await page.evaluate(new Function(`
            const behind = fn.component.create({ name : 'popup', title : 'Edit', parent : document.body });
            ${open}
            const popups = document.querySelectorAll('.__popup');
            return { count : popups.length, last : popups[popups.length - 1].textContent.indexOf('no undo') !== -1 };
        `)), { count : 2, last : true });
    });
});

describe('fn.layout popup and buttons', function() {
    before(fn.before);
    after(fn.after);

    it('popup calls init before render, both with { popup, header, content }', async function() {
        const page = await fn.page();
        assert.deepEqual(await page.evaluate(function() {
            const order = [];
            var keys;
            fn.component.create({
                name : 'popup', title : 'T', parent : document.body,
                init : function(opt) { order.push('init'); keys = Object.keys(opt).sort(); },
                render : function() { order.push('render'); },
            });
            return { order : order, keys : keys };
        }), { order : ['init', 'render'], keys : ['content', 'header', 'popup'] });
    });

    it('btn-close removes its own popup with no caller wiring', async function() {
        const page = await fn.page();
        assert.equal(await page.evaluate(function() {
            const popup = fn.component.create({ name : 'popup', title : 'T', parent : document.body });
            popup.querySelector('button[title="Close"]').click();
            return document.querySelectorAll('.__popup').length;
        }), 0);
    });

    it('btn-save, btn-new and btn-delete pass opt.event straight through', async function() {
        const page = await fn.page();
        assert.deepEqual(await page.evaluate(function() {
            return ['btn-save', 'btn-new', 'btn-delete'].map(function(name) {
                var fired = false;
                const button = fn.component.create({ name : name, event : { click : function() { fired = true; } } });
                document.body.appendChild(button);
                button.click();
                return fired;
            });
        }), [true, true, true]);
    });

    it('clicking a popup brings it to the front of its siblings', async function() {
        const page = await fn.page();
        assert.equal(await page.evaluate(function() {
            const first = fn.component.create({ name : 'popup', title : 'A', parent : document.body });
            fn.component.create({ name : 'popup', title : 'B', parent : document.body });
            first.click();
            return document.body.lastElementChild === first;
        }), true);
    });
});
