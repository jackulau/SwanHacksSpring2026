/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const col = app.findCollectionByNameOrId("assignments");
  const field = col.fields.find((f) => f.name === "description");
  if (field) {
    field.max = 0;
  }
  app.save(col);
}, (app) => {
  // no rollback needed
});
