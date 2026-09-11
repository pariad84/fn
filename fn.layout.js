(function() {
    var fn = window.fn;

    // 7. opt convention + self-contained components: every layout takes one `opt` object, and
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
                },
            });

            var header = fn.element.create({
                parent : popup,
                tagName : 'div',
                style : { display : 'flex', justifyContent : 'space-between', padding : '8px 12px', borderBottom : '1px solid #e4e6ea' },
            });
            fn.element.create({ parent : header, tagName : 'div', style : { fontWeight : '600' }, text : opt.title || 'Popup' });
            fn.component.create({ name : 'close-btn', parent : header });

            var content = fn.element.create({ parent : popup, tagName : 'div', style : { padding : '12px' } });

            popup.content = content;
            popup._.caller = opt.caller;
            popup._.fields = opt.fields;

            if (opt.render) {
                opt.render(popup);
            }

            document.body.appendChild(popup);
            return popup;
        }
    });

    fn.component.layout.set({
        name : 'close-btn',
        layout : function(opt = {}) {
            return fn.element.create({
                tagName : 'button',
                attribute : { type : 'button', title : 'Close' },
                text : '✕',
                event : { click : function(e) { e.target.closest('.__popup').remove(); } },
            });
        }
    });

    fn.component.layout.set({
        name : 'save-btn',
        layout : function(opt = {}) {
            return fn.element.create({
                tagName : 'button',
                attribute : { type : 'button', title : 'Save' },
                text : 'Save',
                event : {
                    click : function(e) {
                        var popup = e.target.closest('.__popup');
                        var form = popup.querySelector('.__form');
                        form.save();
                        if (popup._.caller) {
                            popup._.caller.refresh();
                        }
                        popup.remove();
                    }
                },
            });
        }
    });
})();
