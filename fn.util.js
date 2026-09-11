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
})();
