

import {
  GraphQLList
} from "graphql";

import {
  resolver,
  defaultListArgs,
} from "graphql-sequelize";

// import createBaseModel from "./create-base";
import createBeforeAfter from "./create-before-after";
import resetInterfaces from "../utils/reset-interfaces";
import getModelDefinition from "../utils/get-model-def";


export default async function createComplexModels(models, keys, typeCollection, mutationFunctions, options = {}) {

  await Promise.all(keys.map(async(modelName) => {
    if (models[modelName].relationships) {
      if (!typeCollection[modelName]) {
        //target does not exist.. excluded from base types?
        return;
      }
      let {fields} = typeCollection[modelName]._typeConfig; //eslint-disable-line
      await Promise.all(Object.keys(models[modelName].relationships).map(async(relName) => {
        let relationship = models[modelName].relationships[relName];
        let targetType = typeCollection[relationship.source];
        let mutationFunction = mutationFunctions[relationship.source];
        // let targetOpts = options[relationship.source];
        if (!targetType) {
          //target does not exist.. excluded from base types?
          return;
        }
        if (options.permission) {
          if (options.permission.relationship) {
            const result = await options.permission.relationship(modelName, relName, relationship.source, options.permission.options);
            if (!result) {
              return;
            }
          }
        }
        const {before, after, afterList} = createBeforeAfter(models[modelName], options);
        if (!targetType) {
          throw `targetType ${targetType} not defined for relationship`;
        }
        switch (relationship.type) {
          case "belongsToMany": //eslint-disable-line
          case "hasMany":
            fields[relName] = {
              type: new GraphQLList(targetType),
              args: Object.assign({}, defaultListArgs(), (mutationFunction || {}).fields),
              resolve: (source, args, context, info) => {
                // console.log("sassssssss", {
                //   source,
                //   args,
                //   context,
                //   info,
                // });
                return resolver(relationship.rel, {
                  before,
                  after: afterList,
                })(source, args, context, info);
              }
            };
            break;
          case "hasOne": //eslint-disable-line
          case "belongsTo":
            fields[relName] = {
              type: targetType,
              resolve: resolver(relationship.rel, {
                before,
                after,
              }),
            };
            break;
          default:
            throw "Unhandled Relationship type";
        }
      }));
      typeCollection[modelName]._typeConfig.fields = fields;//eslint-disable-line
      resetInterfaces(typeCollection[modelName]);
    }
  }));
  keys.forEach((modelName) => {
    if (typeCollection[modelName]) {
      typeCollection[`${modelName}[]`] = new GraphQLList(typeCollection[modelName]);
    }
  });
  await Promise.all(keys.map(async(modelName) => {

    if (!typeCollection[modelName]) {
      //target does not exist.. excluded from base types?
      return;
    }

    const modelDefinition = getModelDefinition(models[modelName]);
    // console.log("found instance methods", {modelName, expose: modelDefinition.expose} );
    if (((modelDefinition.expose || {}).instanceMethods || {}).query) {
      const instanceMethods = modelDefinition.expose.instanceMethods.query;
      // console.log("found instance methods", instanceMethods);
      let {fields} = typeCollection[modelName]._typeConfig; //eslint-disable-line
      await Promise.all(Object.keys(instanceMethods).map(async(methodName) => {
        const methodDefinition = instanceMethods[methodName];
        const {type, args} = methodDefinition;
        let targetType = (type instanceof String || typeof type === "string") ? typeCollection[type] : type;
        if (!targetType) {
          //target does not exist.. excluded from base types?
          return;
        }
        if (options.permission) {
          if (options.permission.queryInstanceMethods) {
            const result = await options.permission.queryInstanceMethods(modelName, methodName, options.permission.options);
            if (!result) {
              return;
            }
          }
        }
        fields[methodName] = {
          type: targetType,
          args,
          resolve: (source, args, context, info) => {
            return source[methodName].apply(source, [args, context, info]);
          },
        };
      }));
      typeCollection[modelName]._typeConfig.fields = fields;//eslint-disable-line
      resetInterfaces(typeCollection[modelName]);
    }
  }));
  return typeCollection;
}