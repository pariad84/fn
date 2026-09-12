# fn

A minimal framework core: a single file, `fn.js`, providing three essentials --

1. `fn.element.create` -- the one DOM-builder primitive everything else is built from.
2. `fn.component.layout.set/get/create` -- a named-layout registry/dispatcher.
3. `fn.data.select/insert/update/delete` -- a CRUD abstraction (localStorage-backed here;
   swapping the storage layer only means rewriting these four functions).

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

- `button` -- the base `<button type="button">` layout; `btn-close`/`btn-save`/`btn-new` are all
  `fn.component.create({ name : 'button', ... })` calls that just preset text/title and pass
  `opt.event` through, each default overridable via `opt.text`/`opt.title`.
- `popup`/`btn-close` -- `popup` provides the `.__popup` wrapper and header that `btn-close` finds
  via `e.target.closest('.__popup')` and removes directly; it is the one button that acts by
  itself, the rest run their caller's handler. The header is the drag handle
  (`fn.util.draggable`) and the `◢` in its bottom-right corner is the resize handle
  (`fn.util.resizable`); a click anywhere on the popup brings it to front via `fn.util.toFront`
  (capture-phase, so it runs before a click handler like `btn-new`'s appends a new popup on top).
  `popup` itself knows nothing about fields or lists -- only `title`/`parent`/`init`/`render`.
- `input`/`select`/`radio` -- field-level layouts, dispatched by `field.form.type` (falling back
  to `input` for any type without its own layout).
- `form`/`list` -- a schema-driven form (one row per field; `form.save()` just collects and returns
  field values, it doesn't persist them) and a table-based list (one row per item, fetched via the
  caller-supplied `opt.select()`, each row's click calling the caller-supplied
  `opt.click({ item, list })`) built on top of those field layouts.

## Using it

Load `fn.js` as a plain `<script>` tag before your app's own script(s) -- it attaches to the
global `fn` object. No build step, no dependencies. `fn.util.js` and `fn.layout.js` are both
optional and load after `fn.js` (`fn.layout.js` needs `fn.util.js` loaded first, for
`fn.util.draggable`): `fn.util.js` for small DOM helpers, `fn.layout.js` for themeable
`popup`/`form`/`list`/etc. reference implementations instead of writing your own from scratch.
