
import Database from "../../src/manager";
import SequelizeAdapter from "@vostro/gqlize-adapter-sequelize";

import TaskModel from "./models/task";
import TaskItemModel from "./models/task-item";
import Item from "./models/item";
import Sequelize from "sequelize";
import { GqlizeAdapter } from '../../lib/types/index';

export async function createInstance() {
  const db = new Database();
  db.registerAdapter(new SequelizeAdapter({}, {
    dialect: "sqlite",
  }) as GqlizeAdapter, "sqlite");
  const parentDef = {
    name: "Parent",
    define: {
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
    },
    relationships: [{
      type: "hasMany",
      model: "Child",
      name: "children",
      options: {
        as: "children",
        foreignKey: "parentId",
      },
    }],
  };
  const childDef = {
    name: "Child",
    define: {
      name: {
        type: Sequelize.STRING,
        allowNull: true,
      },
    },
    relationships: [
      {
        type: "belongsTo",
        model: "Parent",
        name: "parent",
        options: {
          foreignKey: "parentId",
        },
      },
    ],
  };
  db.addDefinition(parentDef);
  db.addDefinition(childDef);
  db.addDefinition(TaskModel);
  db.addDefinition(TaskItemModel);
  db.addDefinition(Item);

  await db.initialise();
  return db;
}


export function validateResult(result: any) {
  if ((result.errors || []).length > 0) {
    console.log("Graphql Error", result.errors); //eslint-disable-line
    throw result.errors[0];
  }
  expect(((result || {}).errors || []).length).toEqual(0);
}
