import {
  // GraphQLSchema,
  GraphQLObjectType,
  GraphQLNonNull,
  GraphQLScalarType,
  GraphQLEnumType,
  // GraphQLList,
} from "graphql";

// import {
//   fromGlobalId,
//   connectionFromArray,
//   nodeDefinitions,
//   connectionDefinitions,
//   connectionArgs,
// } from "graphql-relay";
import globalIdField from "./utils/global-id-field";
import GQLManager from '../manager';
import { Definition, GqlizeOptions, SchemaCache } from '../types';


function globalIdBindValue(defName: string, key: string, instance: GQLManager) {
  return (i: any) => instance.getValueFromInstance(defName, i, key);
}

export default function createBasicFieldsFunc(defName: string, instance: GQLManager, definition: Definition, options: GqlizeOptions, schemaCache: SchemaCache) {
  return function basicFields() {
    let fields = schemaCache.basicFields[defName];
    if (!fields) {
      const modelFields = instance.getFields(defName);
      let exclude = Object.keys(definition.override || {})
        .concat(definition.ignoreFields || []);
      const fieldCommand = options.permission?.field
      if (fieldCommand) {
        exclude = exclude.concat(Object.keys(modelFields)
          .filter((keyName) => keyName !== "id")
          .filter((keyName) => !fieldCommand(defName, keyName, options.permission?.options)));
      }
      const fieldKeys = Object.keys(modelFields)
        .filter((k) => exclude.indexOf(k) === -1);
      if (fieldKeys.length === 0) { // no need to continue
        return {};
      }
      fields = fieldKeys.reduce((f, key) => {
        const fieldDef = modelFields[key];
        if (fieldDef.primaryKey || fieldDef.foreignKey) {
          let globalKeyName;
          if (fieldDef.primaryKey) {
            globalKeyName = defName;
          } else {
            globalKeyName = fieldDef.foreignTarget;
          }
          f[key] = globalIdField(globalKeyName, globalIdBindValue(defName, key, instance), fieldDef.allowNull);
        } else {
          const type = instance.getGraphQLOutputType(defName, key, fieldDef.type);
          f[key] = {
            type: fieldDef.allowNull ? type : new GraphQLNonNull(type),
            description: ((definition.comments || {}).fields || {})[key] || fieldDef.description,
            resolve: fieldDef.resolve,
            args: fieldDef.args,
          };
        }
        return f;
      }, {} as {[key: string]: any});
      if (definition.override) {
        const overrideDefs = definition.override;
        fields = Object.keys(definition.override).reduce((f, fieldName) => {
          if (fieldCommand) {
            if (!fieldCommand(defName, fieldName, options.permission?.options)) {
              return f;
            }
          }
          const fieldDefinition = modelFields[fieldName]; // modelDefinition.define[fieldName];
          if (!fieldDefinition) {
            throw new Error(`Unable to find the field definition for ${defName}->${fieldName}. Please check your model definition for invalid configuration.`);
          }
          const overrideFieldDefinition = overrideDefs[fieldName];
          let type;
          if (!(overrideFieldDefinition.type instanceof GraphQLObjectType) &&
            !(overrideFieldDefinition.type instanceof GraphQLScalarType) &&
            !(overrideFieldDefinition.type instanceof GraphQLEnumType)) {
            type = new GraphQLObjectType(overrideFieldDefinition.type);
          } else {
            type = overrideFieldDefinition.type;
          }
          if (!fieldDefinition.allowNull) {
            type = new GraphQLNonNull(type);
          }
          f[fieldName] = {
            // description: overrideFieldDefinition.description || fieldDefinition.description,
            type,
            resolve: overrideFieldDefinition.output,
          };
          return f;
        }, fields);
      }
      // if(!fields.id) {
      //   throw new Error("id needs to be supplied");
      // }

      schemaCache.basicFields[defName] = fields;
    }
    return fields;
  };
}
