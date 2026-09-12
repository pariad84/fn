// The contract fn.data.remote.js speaks, written down once so both sides can be held to it.
//
// fn's tests point a stub implementing this at fn.data.remote and check fn makes these requests.
// server's tests point the same table at the real /api/data/:resource and check it answers them.
// If the two repos drift, one side's suite goes red.
//
//   fn.data call                          request                     answer
//   select({ key })                       GET    /:key                200 [{ id, data }]
//   select({ key, id })                   GET    /:key/:id            200 { id, data } | 404
//   insert({ key, data })                 POST   /:key    { data }    201 { id, data }
//   update({ key, id, data })             PUT    /:key/:id { data }   200 { id, data } | 404
//   delete({ key, id })                   DELETE /:key/:id            200 { id, data } | 404
//
// A 404 is not an error: fn.data answers "no such row" with undefined, the same as the
// localStorage backing. Any other non-2xx rejects with the server's { message }.
//
// The write bodies are JSON, so the browser preflights them: the server must also answer
// OPTIONS on these paths with the CORS headers, or none of the writes ever leave the page.

const CALLS = [
    { call : 'select', opt : { key : 'item' },                       method : 'GET',    path : '/item' },
    { call : 'select', opt : { key : 'item', id : 7 },               method : 'GET',    path : '/item/7' },
    { call : 'insert', opt : { key : 'item', data : { a : 1 } },     method : 'POST',   path : '/item',   body : { data : { a : 1 } } },
    { call : 'update', opt : { key : 'item', id : 7, data : { a : 2 } }, method : 'PUT', path : '/item/7', body : { data : { a : 2 } } },
    { call : 'delete', opt : { key : 'item', id : 7 },               method : 'DELETE', path : '/item/7' },
];

module.exports = { CALLS };
