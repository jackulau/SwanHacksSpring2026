/// <reference path="../pb_data/types.d.ts" />
// Updates the existing `study_sessions` collection so authenticated users can
// create / read / update / delete their own session rows. The original
// migration (1777500000_hackstack_collections.js) created the collection
// with empty rules, which restricts access to admins only.
migrate((app) => {
  const col = app.findCollectionByNameOrId("study_sessions");

  col.listRule = "@request.auth.id = user.id";
  col.viewRule = "@request.auth.id = user.id";
  col.createRule = "@request.auth.id != '' && @request.auth.id = user.id";
  col.updateRule = "@request.auth.id = user.id";
  col.deleteRule = "@request.auth.id = user.id";

  app.save(col);
}, (app) => {
  const col = app.findCollectionByNameOrId("study_sessions");

  col.listRule = "";
  col.viewRule = "";
  col.createRule = "";
  col.updateRule = "";
  col.deleteRule = "";

  app.save(col);
});
