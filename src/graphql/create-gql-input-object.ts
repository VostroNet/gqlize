import { SchemaCache } from '../types';
import {
  GraphQLInputFieldConfig,
  GraphQLInputObjectType, GraphQLList, ThunkObjMap,
} from "graphql";

export default function createGQLInputObject(name: string, fields: ThunkObjMap<GraphQLInputFieldConfig>, schemaCache: SchemaCache, comment: string) {
  if (!schemaCache.mutationInputFields[name]) {
    schemaCache.mutationInputFields[name] = new GraphQLInputObjectType({
      name,
      fields,
      description: comment,
    });
    schemaCache.mutationInputFields[`${name}[]`] = new GraphQLList(schemaCache.mutationInputFields[name]);
  }
  return schemaCache.mutationInputFields[name];
}
