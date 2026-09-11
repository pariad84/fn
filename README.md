# fn

The framework core of [mini-framework](https://github.com/pariad84/mini-framework): a single
file, `fn.js`, providing four of its seven essentials --

1. `fn.element.create` -- the one DOM-builder primitive everything else is built from.
2. `fn.component.layout.set/get/create` -- a named-layout registry/dispatcher.
3. `fn.data.select/insert/update/delete` -- a CRUD abstraction (localStorage-backed here;
   swapping the storage layer only means rewriting these four functions).
4. A `render` escape hatch -- a column can carry a JS source string instead of a fixed type,
   letting a resource definition (pure data) extend what a field/cell does without touching
   this file.

`fn.js` knows nothing about any specific app: it never references a resource key, a field name,
or a UI label. It also doesn't give you `popup`/`form`/`list`/etc. -- those, plus the remaining
three essentials (schema-driven `form`/`list`, resource-reference fields, the `opt`
single-parameter/self-contained-component convention), are conventions each app built on top
implements for itself. A reference implementation of those conventions
(`fn.component.layout.js`), shared CRUD/UI-wiring helpers (`fn.util.js`), and every example app
demonstrating them live in [mini-framework](https://github.com/pariad84/mini-framework), which
also documents the full design history and conventions this file follows.

This repo is `fn.js`'s canonical source. mini-framework keeps its own copy in sync so its
examples can keep loading it locally without a build step.

## Using it

Load `fn.js` as a plain `<script>` tag before your app's own script(s) -- it attaches to the
global `fn` object. No build step, no dependencies.
