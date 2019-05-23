import Database from "../../src/database";
import SequelizeAdapter from "../../src/adapters/sequelize";
import Sequelize from "sequelize";
import createMutationInput from "../../src/graphql/create-mutation-input";


test("createMutationInput", async() => {
  const db = new Database();
  db.registerAdapter(new SequelizeAdapter({}, {
    dialect: "sqlite",
  }), "sqlite");
  const itemDef = {
    name: "Item",
    define: {
      test: {
        type: Sequelize.INTEGER,
      },
    },
    relationships: [],
  };
  await db.addDefinition(itemDef);
  await db.initialise();
  const inputTypes = {};
  const result = createMutationInput(db, "Item", inputTypes);
  expect(result).toBeDefined();
  expect(inputTypes.Item.required).toBeDefined();
  expect(inputTypes.Item.optional).toBeDefined();
});
