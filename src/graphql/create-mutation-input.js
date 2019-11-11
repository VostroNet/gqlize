import {
  GraphQLInputObjectType, GraphQLNonNull, GraphQLScalarType, GraphQLEnumType, GraphQLList, GraphQLInt,
  GraphQLID,
} from "graphql";

import createGQLInputObject from "./create-gql-input-object";
import { capitalize } from "../utils/word";
import { waterfallSync } from "../utils/waterfall";
//(instance, defName, fields, relationships, inputTypes, false)
export function generateInputFields(instance, defName, definition, defFields, relationships, inputTypes, schemaCache, forceOptional, options) {
  let def = waterfallSync(Object.keys(defFields), (fieldName, fields) => {
    let doNotSkip = true;
    if (options.permission) {
      if (forceOptional) {
        if (options.permission.mutationUpdateInput) {
          doNotSkip = options.permission.mutationUpdateInput(defName, fieldName, options.permission.options);
        }
      } else {
        if (options.permission.mutationCreateInput) {
          doNotSkip = options.permission.mutationCreateInput(defName, fieldName, options.permission.options);
        }
      }
    }
    if (!doNotSkip) {
      return fields;
    }
    const field = defFields[fieldName];
    if (definition.override) {
      const overrideFieldDefinition = definition.override[fieldName];

      if (overrideFieldDefinition) {
        const type = overrideFieldDefinition.inputType || overrideFieldDefinition.type;
        let name = type.name;
        if (!overrideFieldDefinition.inputType) {
          name = `${type.name}${capitalize(fieldName)}Input`;
        }
        if (forceOptional) {
          name = `${capitalize(type.name)}Optional${capitalize(fieldName)}`;
        }
        let inputType;
        if (!(overrideFieldDefinition.type instanceof GraphQLInputObjectType) &&
          !(overrideFieldDefinition.type instanceof GraphQLScalarType) &&
          !(overrideFieldDefinition.type instanceof GraphQLEnumType)) {
          inputType = createGQLInputObject(name, type.fields, schemaCache);
        } else {
          inputType = type;
        }

        if (!field.allowNull && !field.autoPopulated && !forceOptional) {
          fields[fieldName] = {type: new GraphQLNonNull(inputType)};
        } else {
          fields[fieldName] = {type: inputType};
        }
      }
    }
    if (!fields[fieldName]) {
      if (instance.getGlobalKeys(defName).indexOf(fieldName) > -1) {
        fields[fieldName] = {
          type: GraphQLID,
        };
      } else {
        const type = instance.getGraphQLInputType(defName, `${fieldName}${forceOptional ? "Optional" : "Required"}`, field.type);
        let t = field.allowNull || field.autoPopulated || forceOptional ? type : new GraphQLNonNull(type);
        fields[fieldName] = {
          type: t,
        };
      }
    }
    return fields;
  }, {});

  return waterfallSync(Object.keys(relationships), (relName, fields) => {
    let doNotSkip = true;
    if (options.permission) {
      if (forceOptional) {
        if (options.permission.mutationUpdateInput) {
          doNotSkip = options.permission.mutationUpdateInput(defName, relName, options.permission.options);
        }
      } else {
        if (options.permission.mutationCreateInput) {
          doNotSkip = options.permission.mutationCreateInput(defName, relName, options.permission.options);
        }
      }
    }
    if (!doNotSkip) {
      return fields;
    }
    const relationship = relationships[relName];
    if (!inputTypes[relationship.target]) {
      return fields;
    }
    const fld = {};
    const filterType = instance.getFilterGraphQLType(relationship.target);
    let updateInput, createInput = inputTypes[relationship.target].required;
    if (inputTypes[relationship.target].optional) {
      updateInput = createGQLInputObject(`${defName}${capitalize(relName)}Update`, {
        where: {
          type: filterType,
        },
        input: {
          type: inputTypes[relationship.target].optional,
        },
      }, schemaCache);
    }
    switch (relationship.associationType) {
      case "hasMany":
      case "belongsToMany":
        if (createInput) {
          fld.create = {
            type: new GraphQLList(createInput),
          };
        }
        if (updateInput) {
          fld.update = {
            type: new GraphQLList(updateInput),
          };
        }
        fld.add = {
          type: new GraphQLList(filterType),
        };
        fld.remove = {
          type: new GraphQLList(filterType),
        };
        fld.delete = {
          type: new GraphQLList(filterType),
        };
        break;
      default:
        if (createInput) {
          fld.create = {
            type: createInput,
          };
        }
        if (updateInput) {
          fld.update = {
            type: updateInput,
          };
        }
        fld.delete = {
          type: filterType,
        };
        break;
    }
    fields[relName] = {
      type: createGQLInputObject(`${defName}${capitalize(relName)}${capitalize(relationship.associationType)}Input`, fld, schemaCache),
    };
    return fields;
  }, def);
}

export default function createMutationInput(instance, defName, schemaCache, inputTypes, options) {
  const fields = instance.getFields(defName);
  const relationships = instance.getRelationships(defName);
  const definition = instance.getDefinition(defName);
  let required, optional;
  let doNotSkipUpdate = true, doNotSkipCreate = true;
  if (options.permission) {
    if (options.permission.mutationUpdate) {
      doNotSkipUpdate = options.permission.mutationUpdate(defName, options.permission.options);
    }
    if (options.permission.mutationCreate) {
      doNotSkipCreate = options.permission.mutationCreate(defName, options.permission.options);
    }
  }
  if (doNotSkipCreate) {
    required = createGQLInputObject(`${defName}RequiredInput`, function() {
      return generateInputFields(instance, defName, definition, fields, relationships, inputTypes, schemaCache, false, options);
    }, schemaCache);
  }
  if (doNotSkipUpdate) {
    optional = createGQLInputObject(`${defName}OptionalInput`, function() {
      return generateInputFields(instance, defName, definition, fields, relationships, inputTypes, schemaCache, true, options);
    }, schemaCache);
  }
  const filterType = instance.getFilterGraphQLType(defName);
  return {
    required, optional,
    create: (doNotSkipCreate) ? new GraphQLList(required) : undefined,
    update: (doNotSkipUpdate) ? new GraphQLList(createGQLInputObject(`${defName}UpdateInput`, {
      where: {
        type: filterType,
      },
      limit: {
        type: GraphQLInt,
      },
      input: {
        type: optional,
      },
    }, schemaCache)) : undefined,
    delete: new GraphQLList(filterType),
  };
}




