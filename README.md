# fn

A minimal framework core: a single file, `fn.js`, providing four essentials --

1. `fn.element.create` -- the one DOM-builder primitive everything else is built from.
2. `fn.component.layout.set/get/create` -- a named-layout registry/dispatcher.
3. `fn.data.select/insert/update/delete` -- a CRUD abstraction (localStorage-backed here;
   swapping the storage layer only means rewriting these four functions).
4. A `render` escape hatch -- a column can carry a JS source string instead of a fixed type,
   letting a resource definition (pure data) extend what a field/cell does without touching
   this file.

`fn.js` knows nothing about any specific app: it never references a resource key, a field name,
or a UI label. It also doesn't give you `popup`/`form`/`list`/etc. on its own -- those are
conventions each app built on top implements for itself. This repo also carries `fn.layout.js`,
a reference implementation of those conventions:

- `popup`/`close-btn`/`save-btn` -- `popup` provides the `.__popup` wrapper and header that
  `close-btn`/`save-btn` find via `e.target.closest('.__popup')` and act on directly, with no
  caller-injected callback.
- `input`/`select`/`radio` -- field-level layouts, dispatched by `field.form.type` (falling back
  to `input` for any type without its own layout).
- `form`/`list` -- a schema-driven form (one row per field, via `fn.data.insert`/`update`) and a
  table-based list (one row per item, via `fn.data.select`) built on top of those field layouts.
- `new-btn` -- a button that opens a `popup` with a blank `form`/`save-btn`, then refreshes
  `opt.caller` (typically a `list`) on save.

## Using it

Load `fn.js` as a plain `<script>` tag before your app's own script(s) -- it attaches to the
global `fn` object. No build step, no dependencies. `fn.layout.js` is optional: load it right
after `fn.js` to get themeable `popup`/`form`/`list`/etc. reference implementations instead of
writing your own from scratch.
