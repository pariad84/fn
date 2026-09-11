(function(global) {
    const fn = {};

    fn.component = {};
    fn.component._ = {};
    fn.component.layout = {};
    fn.component.layout.data = {};
    fn.data = {};
    fn.data._ = {};
    fn.element = {};

    // 5. render escape hatch -- a column can carry a JS source string instead of a fixed type,
    // so a resource definition (pure data) can extend what a cell/field does without touching
    // this file. Same mechanism serves both list cells and form fields.
    fn.render = function(opt = {}) {
        var render = new Function('return (' + opt.source + ')')();
        return render(opt.data);
    };

    // 1. fn.element.create -- the one DOM-builder primitive everything else is built from.
    fn.element.create = function(opt = {}) {
        var el = document.createElement(opt.tagName);
        el._ = {};
        if (opt.attribute) {
            for (const [key, value] of Object.entries(opt.attribute)) {
                el.setAttribute(key, value);
            }
        }
        if (opt.style) {
            for (const [key, value] of Object.entries(opt.style)) {
                el.style[key] = value;
            }
        }
        if (opt.parent) {
            opt.parent.appendChild(el);
        }
        if (opt.text) {
            el.textContent = opt.text;
        }
        if (opt.event) {
            for (const [eventType, eventHandler] of Object.entries(opt.event)) {
                el.addEventListener(eventType, eventHandler);
            }
        }
        el._.opt = opt;
        if (opt.data) {
            el._.data = opt.data;
        }
        if (opt.datas) {
            el._.datas = opt.datas;
        }
        return el;
    };

    // 2. fn.component.layout.set/get/create -- named-layout registry/dispatcher.
    fn.component.layout.set = function(opt = {}) {
        this.data[opt.name] = opt.layout;
    };

    fn.component.layout.get = function(opt = {}) {
        return this.data[opt.name];
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

    // 2. fn.component.refresh -- removes opt.parent's current children and recreates the named
    // layout inside it, so the caller.refresh() convention doesn't force every app to reach past
    // fn.component.create into the DOM just to re-render a list/page in place.
    fn.component.refresh = function(opt = {}) {
        Array.from(opt.parent.children).forEach(function(child) { child.remove(); });
        return fn.component.create(opt);
    };

    // 3. fn.data.select/insert/update/delete -- CRUD abstraction. Every layout below only ever
    // talks to these four functions, so swapping localStorage for a real backend later only
    // means rewriting this block, not any layout.
    fn.data._.read = function(opt = {}) {
        var raw = typeof(Storage) !== "undefined" ? localStorage.getItem(opt.key) : null;
        return raw ? JSON.parse(raw) : [];
    };

    fn.data._.write = function(opt = {}) {
        if (typeof(Storage) !== "undefined") {
            localStorage.setItem(opt.key, JSON.stringify(opt.rows));
        }
    };

    fn.data.select = function(opt = {}) {
        var rows = fn.data._.read({ key : opt.key });
        if (opt.id !== undefined) {
            return rows.find(function(row) { return row.id === opt.id; });
        }
        return rows;
    };

    fn.data.insert = function(opt = {}) {
        var rows = fn.data._.read({ key : opt.key });
        var nextId = rows.reduce(function(max, row) { return Math.max(max, row.id); }, 0) + 1;
        var row = { id : nextId, data : opt.data };
        rows.push(row);
        fn.data._.write({ key : opt.key, rows : rows });
        return row;
    };

    fn.data.update = function(opt = {}) {
        var rows = fn.data._.read({ key : opt.key });
        var row = rows.find(function(r) { return r.id === opt.id; });
        if (row) {
            row.data = opt.data;
            fn.data._.write({ key : opt.key, rows : rows });
        }
        return row;
    };

    fn.data.delete = function(opt = {}) {
        var rows = fn.data._.read({ key : opt.key });
        var row = rows.find(function(row) { return row.id === opt.id; });
        fn.data._.write({ key : opt.key, rows : rows.filter(function(row) { return row.id !== opt.id; }) });
        return row;
    };

    global.fn = fn;
})(window);
