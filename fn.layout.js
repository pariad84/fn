(function() {
    var fn = window.fn;

    // opt convention + self-contained components: every layout takes one `opt` object, and
    // buttons below find their own popup/form via .closest('.__popup')/.querySelector('.__form')
    // instead of a caller-injected onClick.
    fn.component.layout.set({
        name : 'popup',
        layout : function(opt = {}) {
            var popup = fn.element.create({
                tagName : 'div',
                attribute : { class : '__popup' },
                style : {
                    position : 'fixed',
                    top : '60px',
                    left : '60px',
                    display : 'flex',
                    flexDirection : 'column',
                    minWidth : '280px',
                    background : '#ffffff',
                    color : '#1a1a1a',
                    border : '1px solid #d7dae0',
                    borderRadius : '8px',
                    boxShadow : '0 8px 24px rgba(0, 0, 0, 0.15)',
                    font : "13px/1.5 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                    overflow : 'hidden',
                },
            });
            // capture, not bubble: must run before a click on e.g. btn-new appends a new popup,
            // otherwise re-fronting this popup afterward (on bubble) would bury that new one.
            popup.addEventListener('click', function() { fn.util.toFront({ el : popup }); }, true);

            var header = fn.element.create({
                parent : popup,
                tagName : 'div',
                style : { display : 'flex', alignItems : 'center', padding : '8px 12px', borderBottom : '1px solid #e4e6ea', cursor : 'move' },
            });
            fn.element.create({ parent : header, tagName : 'div', style : { fontWeight : '600', flex : '1' }, text : opt.title || 'Popup' });
            fn.util.draggable({ el : popup, handle : header });

            var content = fn.element.create({ parent : popup, tagName : 'div', style : { padding : '12px', flex : '1', overflow : 'auto' } });

            fn.util.resizable({
                el : popup,
                handle : fn.element.create({
                    parent : popup,
                    tagName : 'div',
                    text : '◢',
                    style : {
                        position : 'absolute',
                        right : '2px',
                        bottom : '0',
                        width : '14px',
                        height : '14px',
                        lineHeight : '10px',
                        fontSize : '10px',
                        color : '#b7bcc4',
                        cursor : 'nwse-resize',
                        userSelect : 'none',
                    },
                }),
            });

            popup._.header = header;
            popup._.content = content;
            popup._.caller = opt.caller;
            popup._.fields = opt.fields;

            if (opt.init) {
                opt.init({ popup : popup, header : header, content : content });
            }

            fn.component.create({ name : 'btn-close', parent : header });

            if (opt.render) {
                opt.render({ popup : popup, header : header, content : content });
            }

            return popup;
        }
    });

    fn.component.layout.set({
        name : 'button',
        layout : function(opt = {}) {
            return fn.element.create({
                tagName : 'button',
                attribute : Object.assign({ type : 'button' }, opt.attribute),
                text : opt.text,
                style : opt.style,
                event : opt.event,
            });
        }
    });

    fn.component.layout.set({
        name : 'btn-close',
        layout : function(opt = {}) {
            return fn.component.create({
                name : 'button',
                attribute : { title : 'Close' },
                text : '❌',
                event : { click : function(e) { e.target.closest('.__popup').remove(); } },
            });
        }
    });

    fn.component.layout.set({
        name : 'btn-save',
        layout : function(opt = {}) {
            return fn.component.create({
                name : 'button',
                attribute : { title : 'Save' },
                text : opt.text || 'Save',
                event : {
                    click : function(e) {
                        var popup = e.target.closest('.__popup');
                        var form = popup.querySelector('.__form');
                        opt.save(form.save());
                        if (popup._.caller) {
                            popup._.caller.refresh();
                        }
                        popup.remove();
                    }
                },
            });
        }
    });

    fn.component.layout.set({
        name : 'btn-new',
        layout : function(opt = {}) {
            return fn.component.create({
                name : 'button',
                attribute : { title : 'New item' },
                text : '✏️',
                event : { click : function() { opt.click(); } },
            });
        }
    });

    fn.component.layout.set({
        name : 'input',
        layout : function(opt = {}) {
            return fn.element.create({
                tagName : 'input',
                attribute : { type : opt.field.form.type, name : opt.field.name, placeholder : opt.field.form.placeholder || '' },
                style : { display : 'block', width : '100%', marginBottom : '8px', padding : '6px' },
                value : opt.value,
            });
        }
    });

    fn.component.layout.set({
        name : 'select',
        layout : function(opt = {}) {
            var select = fn.element.create({
                tagName : 'select',
                attribute : { name : opt.field.name },
                style : { display : 'block', width : '100%', marginBottom : '8px', padding : '6px' },
            });
            opt.field.form.datas.forEach(function(option) {
                fn.element.create({ tagName : 'option', attribute : { value : option.value }, text : option.label, parent : select });
            });
            if (opt.value !== undefined) {
                select.value = opt.value;
            }
            return select;
        }
    });

    fn.component.layout.set({
        name : 'radio',
        layout : function(opt = {}) {
            var group = fn.element.create({ tagName : 'div', style : { marginBottom : '8px' } });
            var radios = opt.field.form.datas.map(function(option) {
                var radioLabel = fn.element.create({ tagName : 'label', style : { display : 'inline-block', marginRight : '12px', fontWeight : 'normal' }, parent : group });
                var radio = fn.element.create({ tagName : 'input', attribute : { type : 'radio', name : opt.field.name, value : option.value }, parent : radioLabel });
                fn.element.create({ tagName : 'span', text : ' ' + option.label, parent : radioLabel });
                if (opt.value === option.value) {
                    radio.checked = true;
                }
                return radio;
            });
            Object.defineProperty(group, 'value', { get : function() {
                var checked = radios.find(function(radio) { return radio.checked; });
                return checked ? checked.value : undefined;
            } });
            return group;
        }
    });

    fn.component.layout.set({
        name : 'form',
        layout : function(opt = {data : {}}) {
            var el = fn.element.create({ tagName : 'div', attribute : { class : '__form' }, data : opt.data });
            el._.inputs = {};

            opt.fields.forEach(function(field) {
                fn.element.create({
                    tagName : 'label',
                    text : field.label,
                    style : { display : 'block', marginBottom : '4px', fontSize : '12px', color : '#555' },
                    parent : el,
                });

                el._.inputs[field.name] = fn.component.create({
                    name : fn.component.layout.get({ name : field.form.type }) ? field.form.type : 'input',
                    field : field,
                    value : opt.data[field.name],
                    parent : el,
                });
            });

            el.save = function() {
                var data = {};
                opt.fields.forEach(function(field) {
                    data[field.name] = el._.inputs[field.name].value;
                });
                return data;
            };

            return el;
        }
    });

    fn.component.layout.set({
        name : 'list',
        layout : function(opt = {}) {
            var el = fn.element.create({ tagName : 'table', style : { width : '100%', borderCollapse : 'collapse' } });

            var headRow = fn.element.create({ tagName : 'tr', parent : fn.element.create({ tagName : 'thead', parent : el }) });
            opt.fields.forEach(function(field) {
                fn.element.create({ tagName : 'th', text : field.label, style : { textAlign : 'left', padding : '8px', borderBottom : '1px solid #ccc' }, parent : headRow });
            });

            var tbody = fn.element.create({ tagName : 'tbody', parent : el });

            el.refresh = function() {
                Array.from(tbody.children).forEach(function(child) { child.remove(); });
                var items = opt.select();
                items.forEach(function(item) {
                    var tr = fn.element.create({
                        tagName : 'tr',
                        style : { cursor : 'pointer' },
                        parent : tbody,
                        event : { click : function() { opt.click(item, el); } },
                    });
                    opt.fields.forEach(function(field) {
                        fn.element.create({ tagName : 'td', text : item[field.name], style : { padding : '8px', borderBottom : '1px solid #eee' }, parent : tr });
                    });
                });
            };

            el.refresh();
            return el;
        }
    });
})();
