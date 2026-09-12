const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { harness } = require('./helpers');

const fn = harness(['fn.js']);

describe('fn.component', function() {
    before(fn.before);
    after(fn.after);

    it('registers a layout and reads it back', async function() {
        const page = await fn.page();
        assert.equal(await page.evaluate(function() {
            function layout() { return document.createElement('i'); }
            fn.component.layout.set({ name : 'thing', layout : layout });
            return fn.component.layout.get({ name : 'thing' }) === layout;
        }), true);
    });

    it('get answers undefined for a name that was never set', async function() {
        const page = await fn.page();
        assert.equal(await page.evaluate(function() {
            return fn.component.layout.get({ name : 'nope' });
        }), undefined);
    });

    it('create dispatches to the layout and returns its element', async function() {
        const page = await fn.page();
        assert.equal(await page.evaluate(function() {
            fn.component.layout.set({ name : 'thing', layout : function() {
                return fn.element.create({ tagName : 'i', text : 'made' });
            } });
            return fn.component.create({ name : 'thing' }).outerHTML;
        }), '<i>made</i>');
    });

    it('hands the whole opt to the layout', async function() {
        const page = await fn.page();
        assert.deepEqual(await page.evaluate(function() {
            var seen;
            fn.component.layout.set({ name : 'thing', layout : function(opt) {
                seen = opt;
                return document.createElement('i');
            } });
            fn.component.create({ name : 'thing', title : 'x', fields : [1, 2] });
            return [seen.name, seen.title, seen.fields];
        }), ['thing', 'x', [1, 2]]);
    });

    it('appends the result to opt.parent', async function() {
        const page = await fn.page();
        assert.equal(await page.evaluate(function() {
            fn.component.layout.set({ name : 'thing', layout : function() {
                return fn.element.create({ tagName : 'i' });
            } });
            const parent = document.createElement('div');
            fn.component.create({ name : 'thing', parent : parent });
            return parent.children.length;
        }), 1);
    });

    it('does not double-append a layout that parented its own root', async function() {
        const page = await fn.page();
        assert.equal(await page.evaluate(function() {
            fn.component.layout.set({ name : 'thing', layout : function(opt) {
                return fn.element.create({ tagName : 'i', parent : opt.parent });
            } });
            const parent = document.createElement('div');
            fn.component.create({ name : 'thing', parent : parent });
            return parent.children.length;
        }), 1);
    });

    it('throws for an unknown layout, naming it', async function() {
        const page = await fn.page();
        const message = await page.evaluate(function() {
            try {
                fn.component.create({ name : 'missing' });
                return null;
            } catch (error) {
                return error.message;
            }
        });
        assert.match(message, /missing/);
    });

    it('set and get do not depend on being called as a method',
        async function() {
            const page = await fn.page();
            const result = await page.evaluate(function() {
                const set = fn.component.layout.set;
                try {
                    set({ name : 'detached', layout : function() { return document.createElement('i'); } });
                    return 'worked';
                } catch (error) {
                    return 'threw: ' + error.message;
                }
            });
            assert.equal(result, 'worked');
        });
});
