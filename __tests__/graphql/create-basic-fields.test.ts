import Database from "../../src/manager";
import createBasicFieldsFunc from "../../src/graphql/create-basic-fields";
import SequelizeAdapter from "@vostro/gqlize-adapter-sequelize";

import {
  GraphQLID,
  GraphQLNonNull,
  GraphQLString,
  GraphQLObjectType,
  GraphQLScalarType,
} from "graphql";
import Sequelize from "sequelize";
import createSchemaCache from "../../src/graphql/create-schema-cache";
import { Definition } from '../../src/types';
import { GqlizeAdapter } from '../../lib/types/index';

test("createBasicFieldsFunc - empty define", async() => {
  const db = new Database();
  db.registerAdapter(new SequelizeAdapter({}, {
    dialect: "sqlite",
  }) as GqlizeAdapter, "sqlite");
  const itemDef = {
    name: "Item",
    define: {},
    relationships: [],
  } as Definition;
  await db.addDefinition(itemDef);
  await db.initialise();
  const schemaCache = createSchemaCache();
  const basicFieldsFunc = createBasicFieldsFunc(itemDef.name || "", db, itemDef, {}, schemaCache);
  expect(basicFieldsFunc).toBeInstanceOf(Function);
  const fields = basicFieldsFunc();
  expect(fields).toBeDefined();
  expect(fields.id).toBeDefined();
  expect(fields.id.type).toBeInstanceOf(GraphQLNonNull);
  expect(fields.id.type.ofType).toEqual(GraphQLID);
});

test("createBasicFieldsFunc - define", async() => {
  const db = new Database();
  db.registerAdapter(new SequelizeAdapter({}, {
    dialect: "sqlite",
  }) as GqlizeAdapter, "sqlite");
  const itemDef = {
    name: "Item",
    define: {
      name: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: "Hello",
      },
    },
    relationships: [],
  } as Definition;
  await db.addDefinition(itemDef);
  await db.initialise();
  const schemaCache = createSchemaCache();
  const basicFieldsFunc = createBasicFieldsFunc(itemDef.name || "", db, itemDef, {}, schemaCache);
  expect(basicFieldsFunc).toBeInstanceOf(Function);
  const fields = basicFieldsFunc();
  expect(fields).toBeDefined();
  expect(fields.name).toBeDefined();
  expect(fields.name.type).toBeInstanceOf(GraphQLNonNull);
  expect(fields.name.type.ofType).toEqual(GraphQLString);
  // expect(fields.name.description).toEqual("Hello");
});


test("createBasicFieldsFunc - define - override", async() => {
  const db = new Database();
  db.registerAdapter(new SequelizeAdapter({}, {
    dialect: "sqlite",
  }) as GqlizeAdapter, "sqlite");
  const itemDef = {
    name: "Item",
    define: {
      nonnull: {
        type: Sequelize.JSON,
        allowNull: false,
        comment: "Hello",
      },
      nullable: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: "Hello",
      },
    },
    override: {
      nonnull: {
        description: "Override",
        type: {
          name: "NewObject",
          fields: {
            test: {
              type: GraphQLString,
            },
          },
        },
      },
      nullable: {
        description: "Override",
        type: {
          name: "NewObject2",
          fields: {
            test: {
              type: GraphQLString,
            },
          },
        },
      },
    },
    relationships: [],
  } as Definition;
  await db.addDefinition(itemDef);
  await db.initialise();
  const schemaCache = createSchemaCache();
  const basicFieldsFunc = createBasicFieldsFunc(itemDef.name || "", db, itemDef, {}, schemaCache);
  expect(basicFieldsFunc).toBeInstanceOf(Function);
  const fields = basicFieldsFunc();
  expect(fields).toBeDefined();
  expect(fields.nonnull).toBeDefined();
  expect(fields.nonnull.type).toBeInstanceOf(GraphQLNonNull);
  expect(fields.nonnull.type.ofType).toBeInstanceOf(GraphQLObjectType);
  // expect(fields.nonnull.description).toEqual("Override");

  expect(fields.nullable).toBeDefined();
  expect(fields.nullable.type).toBeInstanceOf(GraphQLObjectType);
  // expect(fields.nullable.description).toEqual("Override");
});

test("createBasicFieldsFunc - define - with scalar", async() => {
  const db = new Database();
  db.registerAdapter(new SequelizeAdapter({}, {
    dialect: "sqlite",
  }) as GqlizeAdapter, "sqlite");
  const itemDef = {
    name: "Item",
    define: {
      nonnull: {
        type: Sequelize.JSON,
        allowNull: false,
        comment: "Hello",
      },
      nullable: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: "Hello",
      },
    },
    override: {
      nonnull: {
        description: "Override",
        type: GraphQLString,
      },
      nullable: {
        description: "Override",
        type: GraphQLString,
      },
    },
    relationships: [],
  };
  await db.addDefinition(itemDef);
  await db.initialise();

  const schemaCache = createSchemaCache();
  const basicFieldsFunc = createBasicFieldsFunc(itemDef.name, db, itemDef, {}, schemaCache);
  expect(basicFieldsFunc).toBeInstanceOf(Function);
  const fields = basicFieldsFunc();
  expect(fields).toBeDefined();
  expect(fields.nonnull).toBeDefined();
  expect(fields.nonnull.type).toBeInstanceOf(GraphQLNonNull);
  expect(fields.nonnull.type.ofType).toEqual(GraphQLString);
  // expect(fields.nonnull.description).toEqual("Override");
  expect(fields.nullable).toBeDefined();
  expect(fields.nullable.type).toEqual(GraphQLString);
  // expect(fields.nullable.description).toEqual("Override");
});


test("createBasicFieldsFunc - foreign keys", async() => {
  const db = new Database();
  db.registerAdapter(new SequelizeAdapter({}, {
    dialect: "sqlite",
  }) as GqlizeAdapter, "sqlite");
  const itemDef = {
    name: "Item",
    define: {},
    relationships: [{
      type: "hasMany",
      model: "ItemChild",
      name: "children",
      options: {
        as: "children",
        foreignKey: "parentId",
      },
    }],
  } as Definition;
  const itemChildDef = {
    name: "ItemChild",
    define: {},
    relationships: [{
      type: "belongsTo",
      model: "Item",
      name: "parent",
      options: {
        as: "parent",
        foreignKey: "parentId",
      },
    }],
  } as Definition;
  await db.addDefinition(itemDef);
  await db.addDefinition(itemChildDef);
  await db.initialise();
  const schemaCache = createSchemaCache();
  const basicFieldsFunc = createBasicFieldsFunc(itemChildDef.name || "", db, itemChildDef, {}, schemaCache);
  expect(basicFieldsFunc).toBeInstanceOf(Function);
  const fields = basicFieldsFunc();
  expect(fields).toBeDefined();
  expect(fields.parentId).toBeDefined();
  expect(fields.parentId.type).toBeInstanceOf(GraphQLScalarType);
  expect(fields.parentId.type).toEqual(GraphQLID);

});
