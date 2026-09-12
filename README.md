# fn

A minimal framework core: a single file, `fn.js`, providing three essentials --

1. `fn.element.create` -- the one DOM-builder primitive everything else is built from.
2. `fn.component.layout.set/get/create` -- a named-layout registry/dispatcher.
3. `fn.data.select/insert/update/delete` -- a CRUD abstraction (localStorage-backed here;
   swapping the storage layer only means rewriting these four functions -- `fn.data.remote.js`
   is that rewrite, against a server).

`fn.js` knows nothing about any specific app: it never references a resource key, a field name,
or a UI label. It also doesn't give you `popup`/`form`/`list`/etc. on its own -- those are
conventions each app built on top implements for itself. This repo also carries `fn.util.js`, a
few DOM-interaction helpers -- `fn.util.draggable` (one element drags another around by its
`style.left`/`top`), `fn.util.resizable` (one element grows/shrinks another by its
`style.width`/`height`, clamped to a minimum), and `fn.util.toFront` (moves an element to be the
last child of its parent, so it stacks above its siblings by DOM order alone, no z-index) -- and
`fn.layout.js`, a reference implementation of those conventions:

Every layout takes one `opt` object. `opt.event` is a DOM listener map handed straight to
`fn.element.create`, so handlers are attached the same way at every level. The hooks a caller
supplies -- `init`, `render`, `select`, `click` -- are functions, called with a single object when
they carry anything (`init`/`render` get `{ popup, header, content }`, `list`'s `click` gets
`{ item, list }`).

- `button` -- the base `<button type="button">` layout; `btn-close`/`btn-save`/`btn-new`/
  `btn-delete` are all `fn.component.create({ name : 'button', ... })` calls that just preset
  text/title and pass `opt.event` through, each default overridable via `opt.text`/`opt.title`.
- `popup`/`btn-close` -- `popup` provides the `.__popup` wrapper and header that `btn-close` finds
  via `e.target.closest('.__popup')` and removes directly; it is the one button that acts by
  itself, the rest run their caller's handler. The header is the drag handle
  (`fn.util.draggable`) and the `◢` in its bottom-right corner is the resize handle
  (`fn.util.resizable`); a click anywhere on the popup brings it to front via `fn.util.toFront`
  (capture-phase, so it runs before a click handler like `btn-new`'s appends a new popup on top).
  `popup` itself knows nothing about fields or lists -- only `title`/`parent`/`init`/`render`.
- `confirm` -- a popup that asks before a destructive action, built from `popup` and `btn-close`
  rather than `window.confirm` so it looks like the rest of the page and stacks with the popups
  already open behind it. `opt.confirm` runs only on the confirming button; the Cancel button and
  the header's close both just remove it.
- `input`/`select`/`radio` -- field-level layouts, dispatched by `field.form.type` (falling back
  to `input` for any type without its own layout).
- `form`/`list` -- a schema-driven form (one row per field; `form.save()` just collects and returns
  field values, it doesn't persist them) and a table-based list (one row per item, fetched via the
  caller-supplied `opt.select()`, each row's click calling the caller-supplied
  `opt.click({ item, list })`) built on top of those field layouts. `list.refresh()` resolves
  `opt.select()` as a promise, so a list works the same whichever storage layer is loaded, and a
  cell whose field carries `form.datas` shows the matching option's label rather than the stored
  value (falling back to the value itself when no option matches).

## Storage

`fn.js` stores rows in localStorage, under one key per resource holding `{ seq, rows }`. `seq` is
the highest id ever handed out, kept so that deleting the last row does not hand its id to the next
insert -- an edit still open on the old row would otherwise overwrite the new one. A key written by
an older version, holding a bare array of rows, is read as one and seeds `seq` from it.

Reads never throw. Storage the browser refuses -- blocked site data makes `localStorage` access
throw `SecurityError`, even though `Storage` itself is defined -- and a value some other writer
corrupted both read as an empty store and warn, because a page that cannot read is still a page
that renders. Writes are the opposite: a write that did not happen comes back as a **rejected
promise**, so the `Promise.resolve()` below hands it to the caller instead of losing it silently.

`fn.data.remote.js` is a drop-in replacement: load it after
`fn.js` and the same four functions talk to a server instead -- no layout and no app code knows
which one is loaded. Point it at your server before the first call:

```html
<script src="fn.js"></script>
<script src="fn.data.remote.js"></script>
<script>fn.data.remote.url = 'http://localhost:3000/api/data';</script>
```

It expects one endpoint per resource, addressing `fn.data`'s `key` in the path and speaking
`fn.data`'s `{ id, data }` rows in the body -- `GET|POST /:key`, `GET|PUT|DELETE /:key/:id`, with a
write body of `{ "data": { ... } }` and `404` for a row that isn't there. The `server` repo's
`/api/data/:resource` implements exactly this.

**The one convention this imposes:** the four functions may answer with a value or with a promise,
so whatever consumes a result goes through `Promise.resolve()`. That reads the same for both
storage layers -- including on failure, which is why a failed localStorage write is a rejected
promise rather than a throw -- and it is what lets one page run against either:

```js
Promise.resolve(fn.data.select({ key : 'item' })).then(function(rows) { ... });
```

A rejected promise carries the server's message, so a page can put it in front of the user:

```js
Promise.resolve(fn.data.insert({ key : 'item', data : data })).then(saved, function(error) {
    show(error.message);   // e.g. "Title is required"
});
```

## The pages

`index.html` is the framework's own test page: one button, one popup, one list, storing to
localStorage. Open it directly, no server needed.

## Tests

```sh
npm install && npx playwright install chromium
npm test
```

fn is a browser library, so the tests drive a real one: they serve the repo as it stands and load
`fn.js` the way a page does, through a `<script>` tag. Playwright is a **devDependency only** --
nothing ships with the library, and it still loads with no build step and no dependencies.

`tests/remote.test.js` checks fn's half of the contract in `tests/contract.js` against a stub, so
the suite needs no server. The `server` repo checks its half against the same table; if the two
drift, one of the suites goes red.

`tests/admin.test.js` drives `admin.html` exactly as it ships, answering its requests in the
browser instead of over a network -- so the console is covered without a test-only hook in the page
and without the server repo present.

Tests for a known defect are marked **todo**, carrying what is wrong in the message: they run,
they fail, and the run stays green until the defect is fixed. Removing the todo flag is part of the
fix. There are none open at the moment.

`admin.html` is a CRUD console for every resource a server defines, and it needs one running.
Deleting a row asks first -- `admin.html` is the only place with a button that destroys something,
so it is the only place that has to. It
names no resource, no field and no label of its own -- it fetches the definitions from
`/api/resources` and hands their `fields` straight to `list` and `form`, which is what those two
layouts already take. Adding a resource is a JSON file on the server; this page does not change.
The server validates each write against the same definition it served, so the rule behind a
rejected save is the rule the form was rendered from, and its message lands beside the form.
## Using it

Load `fn.js` as a plain `<script>` tag before your app's own script(s) -- it attaches to the
global `fn` object. No build step, no dependencies. `fn.util.js` and `fn.layout.js` are both
optional and load after `fn.js` (`fn.layout.js` needs `fn.util.js` loaded first, for
`fn.util.draggable`): `fn.util.js` for small DOM helpers, `fn.layout.js` for themeable
`popup`/`form`/`list`/etc. reference implementations instead of writing your own from scratch, and
`fn.data.remote.js` to put the rows on a server instead of in localStorage.

`index.html` is a working page built from those conventions -- open it directly, no server needed.
Uncomment its `fn.data.remote.js` tag to run the same page against a backend.
