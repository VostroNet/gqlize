import Sequelize from "sequelize";
import { GraphQLBoolean } from "graphql";
// import {GraphQLID} from "graphql";
// import {toGlobalId} from "graphql-relay/lib/node/node";
import { Definition } from '../../../src/types';

export default {
  name: "Item",
  tableName: "items",
  comment: "item comment",
  define: {
    id: {
      type: Sequelize.UUID,
      allowNull: false,
      unique: true,
      primaryKey: true,
      defaultValue: Sequelize.UUIDV4, // Sequelize.literal("(lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6))))"),
      comment: "The is the id column",
    },
    name: {type: Sequelize.STRING, allowNull: false},
  },
  relationships: [
    {type: "hasOne", model: "Item", name: "hasOne", options: {as: "hasOne", foreignKey: "hasOneId", sourceKey: "id"}},
    {type: "belongsTo", model: "Item", name: "belongsTo", options: {as: "belongsTo", foreignKey: "belongsToId", sourceKey: "id"}},
    {type: "hasMany", model: "Item", name: "children", options: {as: "children", foreignKey: "parentId", sourceKey: "id"}},
    {type: "belongsTo", model: "Item", name: "parent", options: {as: "parent", foreignKey: "parentId", sourceKey: "id"}},
    {type: "belongsTo", model: "Task", name: "task", options: {as: "task", foreignKey: "taskId", sourceKey: "id"}},
    {
      type: "belongsToMany",
      model: "Task",
      name: "btmTasks",
      options: {
        through: "btm-tasks",
        foreignKey: "itemId",
      },
    },
  ],
  comments: {
    fields: {
      name: "name comment",
      hasOne: "hasOne comment",
      children: "children comment",
      testInstanceMethod: "testInstanceMethod comment",
    },
    classMethods: {
      reverseName: "reverseName comment",
    },
  },
  expose: {
    instanceMethods: {
      query: {
        testInstanceMethod: {
          type: GraphQLBoolean,
        },
      },
    },
    classMethods: {
      mutations: {
        reverseName: {
          type: GraphQLBoolean,
        },
      },
    },
  },
  options: {
    tableName: "items",
    hooks: {},
    classMethods: {
      reverseName({input: {amount}}, req) {
        return {
          id: 1,
          name: `reverseName${amount}`,
        };
      },
    },
    instanceMethods: {
      testInstanceMethod({input: {amount}}, req) {
        return [{
          id: this.id,
          name: `${this.name}${amount}`,
        }];
      },
    },
  },
  after({result}: any) {
    if (!result) {
      return result;
    }
    // if ((result.edges || []).length > 0) {
    //   result.edges = result.edges.map((x) => {
    //     const {node} = x;
    //     return node.name !== "item-null" ? x : null;
    //   });
    //   return result;
    // }
    return result.name !== "item-null" ? result : null;
  },
} as Definition;
