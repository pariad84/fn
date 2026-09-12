const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { harness } = require('./helpers');

const fn = harness(['fn.js']);

describe('fn.element.create', function() {
    before(fn.before);
    after(fn.after);

    it('creates the tag and sets attributes', async function() {
        const page = await fn.page();
        const html = await page.evaluate(function() {
            return fn.element.create({ tagName : 'a', attribute : { href : '/x', title : 'go' } }).outerHTML;
        });
        assert.equal(html, '<a href="/x" title="go"></a>');
    });

    it('applies style properties', async function() {
        const page = await fn.page();
        const colour = await page.evaluate(function() {
            return fn.element.create({ tagName : 'div', style : { color : 'rgb(1, 2, 3)' } }).style.color;
        });
        assert.equal(colour, 'rgb(1, 2, 3)');
    });

    it('appends to opt.parent', async function() {
        const page = await fn.page();
        const tag = await page.evaluate(function() {
            const parent = document.createElement('div');
            fn.element.create({ tagName : 'span', parent : parent });
            return parent.firstChild.tagName;
        });
        assert.equal(tag, 'SPAN');
    });

    it('sets text, including a stored 0 or false', async function() {
        const page = await fn.page();
        const texts = await page.evaluate(function() {
            return [0, false, '', 'hi'].map(function(text) {
                return fn.element.create({ tagName : 'td', text : text }).textContent;
            });
        });
        assert.deepEqual(texts, ['0', 'false', '', 'hi']);
    });

    it('leaves textContent alone for undefined and null', async function() {
        const page = await fn.page();
        const texts = await page.evaluate(function() {
            return [undefined, null].map(function(text) {
                return fn.element.create({ tagName : 'td', text : text }).textContent;
            });
        });
        assert.deepEqual(texts, ['', '']);
    });

    it('sets value, including an empty string', async function() {
        const page = await fn.page();
        const values = await page.evaluate(function() {
            return ['', 'x'].map(function(value) {
                return fn.element.create({ tagName : 'input', value : value }).value;
            });
        });
        assert.deepEqual(values, ['', 'x']);
    });

    it('attaches every handler in opt.event', async function() {
        const page = await fn.page();
        const fired = await page.evaluate(function() {
            const fired = [];
            const el = fn.element.create({ tagName : 'button', event : {
                click : function() { fired.push('click'); },
                focus : function() { fired.push('focus'); },
            } });
            document.body.appendChild(el);
            el.focus();
            el.click();
            return fired;
        });
        assert.deepEqual(fired.sort(), ['click', 'focus']);
    });

    it('gives every element an _ bag', async function() {
        const page = await fn.page();
        assert.equal(await page.evaluate(function() {
            return typeof fn.element.create({ tagName : 'div' })._;
        }), 'object');
    });

    // --- Defects. Written as todo: they run, they fail, and the run stays green until they are
    // fixed. Remove the todo flag with the fix.

    it('rejects an opt with no tagName instead of building <undefined>',
        { todo : 'creates <undefined> silently, where fn.component.create throws on a bad name' },
        async function() {
            const page = await fn.page();
            const result = await page.evaluate(function() {
                try {
                    return { html : fn.element.create({ tag : 'div', text : 'x' }).outerHTML };
                } catch (error) {
                    return { threw : error.message };
                }
            });
            assert.ok(result.threw, `expected a throw, got ${result.html}`);
        });

    it('fills the element before putting it in the document',
        { todo : 'appends first, so the element enters the document empty and is then mutated' },
        async function() {
            const page = await fn.page();
            const textAtAppend = await page.evaluate(function() {
                const parent = document.createElement('div');
                document.body.appendChild(parent);
                const seen = [];
                const append = Element.prototype.appendChild;
                Element.prototype.appendChild = function(child) {
                    seen.push(child.textContent);
                    return append.call(this, child);
                };
                fn.element.create({ tagName : 'span', parent : parent, text : 'hello' });
                Element.prototype.appendChild = append;
                return seen[0];
            });
            assert.equal(textAtAppend, 'hello');
        });

    it('does not retain the caller opt on every element',
        { todo : 'el._.opt/_.data/_.datas are written and never read, and hold the parent node and handlers' },
        async function() {
            const page = await fn.page();
            const kept = await page.evaluate(function() {
                const parent = document.createElement('div');
                const el = fn.element.create({ tagName : 'div', parent : parent, data : { a : 1 }, datas : [1] });
                return Object.keys(el._);
            });
            assert.deepEqual(kept, []);
        });
});
