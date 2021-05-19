import {
  GraphQLInputObjectType, GraphQLNonNull, GraphQLScalarType, GraphQLEnumType, GraphQLList, GraphQLInt,
  GraphQLID,
} from "graphql";

import createGQLInputObject from "./create-gql-input-object";
import {capitalize} from "../utils/word";
import {waterfallSync} from "../utils/waterfall";
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
    const comment = ((definition.comments || {}).fields || {})[fieldName] || field.description;
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
          fields[fieldName] = {
            type: new GraphQLNonNull(inputType),
            description: comment,
          };
        } else {
          fields[fieldName] = {
            type: inputType,
            description: comment,
          };
        }
      }
    }
    if (!fields[fieldName]) {
      if (instance.getGlobalKeys(defName).indexOf(fieldName) > -1) {
        fields[fieldName] = {
          type: GraphQLID,
          description: comment || `This a primary key for ${defName}`,
        };
      } else {
        const type = instance.getGraphQLInputType(defName, `${fieldName}${forceOptional ? "Optional" : "Required"}`, field.type);
        let t = field.allowNull || field.autoPopulated || forceOptional ? type : new GraphQLNonNull(type);
        fields[fieldName] = {
          type: t,
          description: comment,
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
          description: "This will apply a filter to your mutation",
        },
        input: {
          type: inputTypes[relationship.target].optional,
          description: "This will update the items that you targeted with the filter in the where element",
        },
      }, schemaCache);
    }
    switch (relationship.associationType) {
      case "hasMany":
      case "belongsToMany":
        if (createInput) {
          fld.create = {
            type: new GraphQLList(createInput),
            description: `This will create a new element with a relationship to the current ${defName}`,
          };
        }
        if (updateInput) {
          fld.update = {
            type: new GraphQLList(updateInput),
            description: `This will update any matching elements that have a relationship to the current ${defName}`,
          };
        }
        fld.add = {
          type: new GraphQLList(filterType),
          description: `This will add any matching elements with a relationship to the current ${defName}`,
        };
        fld.remove = {
          type: new GraphQLList(filterType),
          description: `This will remove the relationship from any matching elements from the current ${defName}`,
        };
        fld.delete = {
          type: new GraphQLList(filterType),
          description: `This will delete any matching elements that have a relationship with the current ${defName}`,
        };
        break;
      default:
        if (createInput) {
          fld.create = {
            type: createInput,
            description: `This will create a new element with a relationship to the current ${defName}`,
          };
        }
        if (updateInput) {
          fld.update = {
            type: updateInput,
            description: `This will update any matching elements that have a relationship to the current ${defName}`,
          };
        }
        fld.delete = {
          type: filterType,
          description: `This will delete any matching elements that have a relationship with the current ${defName}`,
        };
        break;
    }
    fields[relName] = {
      type: createGQLInputObject(`${defName}${capitalize(relName)}${capitalize(relationship.associationType)}Input`, fld, schemaCache),
      description: `This is the mutation object for ${defName}${capitalize(relName)}${capitalize(relationship.associationType)}`,
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
        description: "If provided this will restrict to changes to only the elements that match",
      },
      limit: {
        type: GraphQLInt,
        description: "If provided this will restrict the changes to only the first amount of ${limit}",
      },
      input: {
        type: optional,
        description: "This is the input for the data",
      },
    }, schemaCache)) : undefined,
    delete: new GraphQLList(filterType),
  };
}




