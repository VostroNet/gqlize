import Database from "../../src/manager";
import SequelizeAdapter from "@vostro/gqlize-adapter-sequelize";
import createComplexFieldsFunc from "../../src/graphql/create-complex-fields";
import {GraphQLObjectType, GraphQLInt} from "graphql";
import createSchemaCache from "../../src/graphql/create-schema-cache";
import { Definition, GqlizeAdapter } from '../../src/types';
test("createComplexFieldsFunc - empty define", async() => {
  const db = new Database();
  db.registerAdapter(new SequelizeAdapter({}, {
    dialect: "sqlite",
  }) as GqlizeAdapter, "sqlite");
  const itemDef = {
    name: "Item",
    define: {},
    relationships: [],
    expose: {
      instanceMethods: {
        query: {
          testInstanceMethod: {
            type: GraphQLInt,
          },
        },
      },
    },
    instanceMethods: {
      testInstanceMethod() {
        return 2;
      },
    },
  } as Definition;
  await db.addDefinition(itemDef);
  await db.initialise();
  await db.sync();
  const schemaCache = createSchemaCache();
  schemaCache.types.Item = new GraphQLObjectType({
    name: "Item",
    fields: {}
  });
  const func = createComplexFieldsFunc(itemDef.name || "", db, itemDef, {}, schemaCache);
  expect(func).toBeInstanceOf(Function);
  const fields = func();
  expect(fields).toBeDefined();
  expect(fields.testInstanceMethod).toBeDefined();
  expect(fields.testInstanceMethod.resolve).toBeInstanceOf(Function);
  expect(fields.testInstanceMethod.type).toEqual(GraphQLInt);
});
