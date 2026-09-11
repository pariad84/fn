# fn

A single file, `fn.js`, providing:

1. `fn.element.create` -- the one DOM-builder primitive everything else is built from.
2. `fn.component.layout.set/get/create` -- a named-layout registry/dispatcher.
3. `fn.data.select/insert/update/delete` -- a CRUD abstraction (localStorage-backed here;
   swapping the storage layer only means rewriting these four functions).
4. A `render` escape hatch -- a column can carry a JS source string instead of a fixed type,
   letting a resource definition (pure data) extend what a field/cell does without touching
   this file.

`fn.js` knows nothing about any specific app: it never references a resource key, a field name,
or a UI label.

## Using it

Load `fn.js` as a plain `<script>` tag before your app's own script(s) -- it attaches to the
global `fn` object. No build step, no dependencies.
