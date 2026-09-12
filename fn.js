(function(global) {
    var fn = {};

    fn.component = {};
    fn.component.layout = {};
    fn.component.layout.data = {};
    fn.data = {};
    fn.data._ = {};
    fn.element = {};

    // 1. fn.element.create -- the one DOM-builder primitive everything else is built from.
    fn.element.create = function(opt = {}) {
        if (!opt.tagName) {
            throw new Error('fn.element.create needs a tagName');
        }
        var el = document.createElement(opt.tagName);
        el._ = {};
        if (opt.attribute) {
            for (var [key, value] of Object.entries(opt.attribute)) {
                el.setAttribute(key, value);
            }
        }
        if (opt.style) {
            for (var [key, value] of Object.entries(opt.style)) {
                el.style[key] = value;
            }
        }
        // Not a truthiness test: a list cell showing a stored 0 or false is text, not an empty cell.
        if (opt.text !== undefined && opt.text !== null) {
            el.textContent = opt.text;
        }
        if (opt.value !== undefined) {
            el.value = opt.value;
        }
        if (opt.event) {
            for (var [eventType, eventHandler] of Object.entries(opt.event)) {
                el.addEventListener(eventType, eventHandler);
            }
        }
        // Last, so the element enters the document finished instead of arriving empty and then
        // being filled in place.
        if (opt.parent) {
            opt.parent.appendChild(el);
        }
        return el;
    };

    // 2. fn.component.layout.set/get/create -- named-layout registry/dispatcher.
    fn.component.layout.set = function(opt = {}) {
        fn.component.layout.data[opt.name] = opt.layout;
    };

    fn.component.layout.get = function(opt = {}) {
        return fn.component.layout.data[opt.name];
    };

    fn.component.create = function(opt = {}) {
        var layout = fn.component.layout.get(opt);
        if (!layout) {
            throw new Error('Unknown component layout: ' + opt.name);
        }
        var el = layout(opt);
        if (opt.parent) {
            opt.parent.appendChild(el);
        }
        return el;
    };

    // 3. fn.data.select/insert/update/delete -- CRUD abstraction. Every layout only ever talks to
    // these four functions, so swapping localStorage for a real backend means rewriting this block
    // and nothing else -- fn.data.remote.js is that rewrite.
    //
    // Reads never throw. Storage the browser refuses -- where blocked site data makes access throw
    // SecurityError even though Storage is defined -- and a value some other writer corrupted both
    // answer as an empty store, because a page that cannot read is still a page that renders.
    // Writes are the opposite: a write that did not happen comes back as a rejected promise, so
    // the Promise.resolve() callers already wrap results in hands it to them rather than losing it.
    //
    // A key holds { seq, rows }: seq is the highest id ever handed out, kept so that deleting the
    // last row does not hand its id to the next insert. A key still holding a bare array of rows
    // is read as one, seeding seq from it once.
    fn.data._.read = function(opt = {}) {
        try {
            var raw = localStorage.getItem(opt.key);
            if (raw === null) {
                return { seq : 0, rows : [] };
            }
            var stored = JSON.parse(raw);
            if (Array.isArray(stored)) {
                return {
                    seq : stored.reduce(function(max, row) { return Math.max(max, row.id); }, 0),
                    rows : stored,
                };
            }
            return stored;
        } catch (error) {
            console.warn('fn.data: cannot read "' + opt.key + '" (' + error.name + '), reading it as empty');
            return { seq : 0, rows : [] };
        }
    };

    fn.data._.write = function(opt = {}) {
        try {
            localStorage.setItem(opt.key, JSON.stringify(opt.store));
            return null;
        } catch (error) {
            return Promise.reject(error);
        }
    };

    fn.data.select = function(opt = {}) {
        var rows = fn.data._.read({ key : opt.key }).rows;
        if (opt.id !== undefined) {
            return rows.find(function(row) { return row.id === opt.id; });
        }
        return rows;
    };

    fn.data.insert = function(opt = {}) {
        var store = fn.data._.read({ key : opt.key });
        var row = { id : store.seq + 1, data : opt.data };
        store.seq = row.id;
        store.rows.push(row);
        var failed = fn.data._.write({ key : opt.key, store : store });
        return failed ? failed : row;
    };

    fn.data.update = function(opt = {}) {
        var store = fn.data._.read({ key : opt.key });
        var row = store.rows.find(function(candidate) { return candidate.id === opt.id; });
        if (!row) {
            return undefined;
        }
        row.data = opt.data;
        var failed = fn.data._.write({ key : opt.key, store : store });
        return failed ? failed : row;
    };

    fn.data.delete = function(opt = {}) {
        var store = fn.data._.read({ key : opt.key });
        var row = store.rows.find(function(candidate) { return candidate.id === opt.id; });
        if (!row) {
            return undefined;
        }
        store.rows = store.rows.filter(function(candidate) { return candidate.id !== opt.id; });
        var failed = fn.data._.write({ key : opt.key, store : store });
        return failed ? failed : row;
    };

    global.fn = fn;
})(window);
