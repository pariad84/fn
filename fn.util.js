(function() {
    var fn = window.fn;
    fn.util = {};

    // fn.util.draggable -- lets opt.handle (default: opt.el) drag opt.el around by its
    // style.left/top, so opt.el must be position: fixed/absolute. mousemove/mouseup listeners
    // are only attached for the duration of a drag, not left sitting on document forever.
    fn.util.draggable = function(opt = {}) {
        var el = opt.el;
        var handle = opt.handle || el;

        handle.addEventListener('mousedown', function(e) {
            if (e.target.closest('button')) {
                return;
            }
            var rect = el.getBoundingClientRect();
            var offsetX = e.clientX - rect.left;
            var offsetY = e.clientY - rect.top;

            var onMouseMove = function(e) {
                el.style.left = (e.clientX - offsetX) + 'px';
                el.style.top = (e.clientY - offsetY) + 'px';
            };
            var onMouseUp = function() {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            };
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);

            e.preventDefault();
        });
    };

    // fn.util.resizable -- lets opt.handle grow/shrink opt.el by its style.width/height,
    // clamped to opt.minWidth/opt.minHeight (default 150/80). Same attach-during-drag-only
    // listener lifecycle as fn.util.draggable.
    fn.util.resizable = function(opt = {}) {
        var el = opt.el;
        var handle = opt.handle;
        var minWidth = opt.minWidth || 150;
        var minHeight = opt.minHeight || 80;

        handle.addEventListener('mousedown', function(e) {
            var startX = e.clientX;
            var startY = e.clientY;
            var startWidth = el.offsetWidth;
            var startHeight = el.offsetHeight;

            var onMouseMove = function(e) {
                el.style.width = Math.max(minWidth, startWidth + (e.clientX - startX)) + 'px';
                el.style.height = Math.max(minHeight, startHeight + (e.clientY - startY)) + 'px';
            };
            var onMouseUp = function() {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            };
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);

            e.preventDefault();
            e.stopPropagation();
        });
    };
})();
