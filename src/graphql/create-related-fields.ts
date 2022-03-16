import createListObject from "./create-list-object";
// import { fromCursor, toCursor } from "./objects/cursor";
import {capitalize} from "../utils/word";
import { SchemaCache, GqlizeOptions, Definition, DefinitionFields, HookMap, Relationship, WhereOperators, Association } from '../types';
import GQLManager from '../manager';
import { GraphQLType, GraphQLArgs } from "graphql";
import Events from "../events";

export default function createRelatedFieldsFunc(
  defName: string,
  instance: GQLManager,
  definition: Definition,
  options: GqlizeOptions,
  schemaCache: SchemaCache
) {
  return function relatedFields() {

    let fields = schemaCache.relatedFields[defName];
    if (!fields && schemaCache.types[defName]) {
      const associations = instance.getAssociations(defName);
      const associationKeys = Object.keys(associations);

      let include;
      if (associationKeys.length > 0) {
        fields = associationKeys.reduce((f, relName) => {
          const association = associations[relName];
          if (options.permission?.relationship) {
            const result = options.permission.relationship(
              defName,
              relName,
              association.target,
              options.permission.options
            );
            if (!result) {
              return f;
            }
            
          }
          const targetObject = schemaCache.types[association.target];
          const targetDef = instance.getDefinition(association.target);
          if (!targetObject) {
            // `targetType ${relationship.target} not defined for relationship`;
            return f;
          }
          switch (association.associationType) {
            case "hasOne":
            case "belongsTo":
              f[relName] = {
                type: targetObject,
                description: ((definition.comments || {}).fields || {})[relName],
                resolve(source: any, args: any, context: any, info: any) {
                  return instance.resolveSingleRelationship(
                    targetDef.name || "",
                    association,
                    source,
                    args,
                    context,
                    info,
                  );
                },
              };
              break;
            default:
              f[relName] = createManyObject(instance, schemaCache, targetDef, targetObject, "", association, (definition.comments?.fields || {})[relName]);
              break;
          }

          return f;
        }, {} as any);
      }
      schemaCache.relatedFields[defName] = fields;
    }
    return fields;
  };
}

function createManyObject(instance: GQLManager, schemaCache: SchemaCache, targetDef: Definition, targetObject: any, prefix: string, relationship: Association, comment: string) {
  if(targetDef?.name) {
    return createListObject(instance, schemaCache, targetDef.name, targetObject, (source: any, args: any, context: any, info: any) => {
      if(targetDef?.name) {
        return instance.resolveManyRelationship(
          targetDef.name,
          relationship,
          source,
          args,
          context,
          info,
        );
      }
      throw "unable to continue";
    }, prefix, `${relationship.associationType}${capitalize(relationship.name)}`, undefined, comment);
  }
}
