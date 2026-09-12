// A drop-in replacement for the localStorage-backed fn.data in fn.js: load it after fn.js and the
// same four functions talk to a server instead. This is the whole cost of swapping the storage
// layer -- no layout and no app code knows which one is loaded.
//
// The one difference the caller sees: these four return a Promise, so anything consuming a result
// goes through Promise.resolve(), which leaves the localStorage implementation working unchanged.
(function() {
    var fn = window.fn;

    fn.data.remote = {};
    // Where server's /api/data/:resource lives. Assign it before the first call.
    fn.data.remote.url = 'http://localhost:3000/api/data';

    fn.data.remote.path = function(opt = {}) {
        var path = fn.data.remote.url + '/' + encodeURIComponent(opt.key);
        return opt.id !== undefined ? path + '/' + encodeURIComponent(opt.id) : path;
    };

    fn.data.remote.request = function(opt = {}) {
        return fetch(opt.path, {
            method : opt.method,
            headers : opt.data ? { 'Content-Type' : 'application/json' } : undefined,
            body : opt.data ? JSON.stringify({ data : opt.data }) : undefined,
        }).then(function(response) {
            // fn.data answers "no such row" with undefined, the same as the localStorage version.
            if (response.status === 404) {
                return undefined;
            }
            if (!response.ok) {
                return response.json().then(function(body) {
                    throw new Error(body.message || response.statusText);
                });
            }
            return response.json();
        });
    };

    fn.data.select = function(opt = {}) {
        return fn.data.remote.request({ method : 'GET', path : fn.data.remote.path(opt) });
    };

    fn.data.insert = function(opt = {}) {
        return fn.data.remote.request({ method : 'POST', path : fn.data.remote.path({ key : opt.key }), data : opt.data });
    };

    fn.data.update = function(opt = {}) {
        return fn.data.remote.request({ method : 'PUT', path : fn.data.remote.path(opt), data : opt.data });
    };

    fn.data.delete = function(opt = {}) {
        return fn.data.remote.request({ method : 'DELETE', path : fn.data.remote.path(opt) });
    };
})();
