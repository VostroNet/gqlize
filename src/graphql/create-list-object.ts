
import pageInfo from "./objects/page-info";
import {
  GraphQLObjectType,
  GraphQLList,
  GraphQLInt,
  GraphQLString,
  FieldNode,
} from "graphql";

import { fromCursor, toCursor } from "./objects/cursor";
import {capitalize} from "../utils/word";
import { SchemaCache } from '../types';
import GQLManager from "../manager";
import waterfall from '../utils/waterfall';
import { processAfter } from "./utils/after";
import Events from "../events";
import {visit, Kind, DocumentNode, GraphQLFieldConfig, GraphQLFieldConfigArgumentMap, OperationDefinitionNode} from "graphql";



function processDefaultArgs(args: { before: string; after: string; }) {
  const newArgs: any = {};
  if (args.before) {
    newArgs.before = fromCursor(args.before);
  }
  if (args.after) {
    newArgs.after = fromCursor(args.after);
  }
  return {
    ...args,
    ...newArgs
  };
}


export default function createListObject(instance: GQLManager, schemaCache: SchemaCache, targetDefName: string, targetType: any, resolveData: ((arg0: any, arg1: any, arg2: any, arg3: any) => PromiseLike<{ total: any; models: any; }>), prefix = "", suffix = "", customArgs?: any, comment?: string) {
  const name = `${capitalize(prefix)}${capitalize(targetDefName)}${capitalize(suffix)}`;
  if (schemaCache.lists[name]) {
    return schemaCache.lists[name]; //TODO: figure out why this is getting hit?
  }
  const orderBy = instance.getOrderByGraphQLType(targetDefName);
  const definition = instance.getDefinition(targetDefName);
  const response = {
    description: comment,
    type: new GraphQLObjectType({
      name: `${name}List`,
      fields() {
        return {
          pageInfo: {
            type: pageInfo,
            description: "Pager object for cursor based operations",
          },
          total: {
            type: GraphQLInt,
            description: "Total amount of records available",
          },
          edges: {
            type: new GraphQLList(new GraphQLObjectType({
              name: `${name}Edge`,
              fields: {
                node: {
                  type: targetType,
                },
                cursor: {
                  type: GraphQLString,
                },
              },
              description: `${name} edge`,
            })),
            description: `List of edges for ${name}`,
          },
        };
      },
    }),
    args: customArgs || Object.assign({
      after: {
        type: GraphQLString,
        description: "If provided it will return results after the provided cursor",
      },
      first: {
        type: GraphQLInt,
        description: "If provided the results will be the first ${amount} of records from provided cursor, if a cursor is not provided the results will be the first ${amount} of records.",
      },
      before: {
        type: GraphQLString,
        description: "If provided it will return results before the provided cursor",
      },
      last: {
        type: GraphQLInt,
        description: "If provided the results will be the first ${amount} of records from provided cursor, if a cursor is not provided  the results will be the last ${amount} of records.",
      },
      orderBy: {
        type: orderBy,
        description: "If provided this will sort the results by the supplied column and direction",
      }
    }, instance.getDefaultListArgs(targetDefName)),
    async resolve(source: any, args: { after: any; before: any; first: any; last: any; }, context: any, info: any) {


      const ignoreFields = ["edges", "node"]
      const schemaPath: string[] = []
      const queryMapArr: any = [];
      let arg = {};
      visit(info.fieldNodes, {
        [Kind.FIELD]: {
          enter(node, key, parent, path, ancestors) {
            if(ignoreFields.indexOf(node.name.value) > -1) {
              return node;
            }
            // test if field 
            if(schemaPath.length === 0) {
              schemaPath.push(targetDefName)
              queryMapArr.push({
                __type: targetDefName,
                __args: []
              })
            } else {

              const currentModel = schemaPath[schemaPath.length - 1];
              const currentDef = instance.getDefinition(currentModel);

              if (node.selectionSet) {
                const rel = currentDef.relationships?.find((r) => r.name === node.name.value);
                schemaPath.push(rel?.model || "")
                queryMapArr.push({
                  __type: rel?.model || "",
                  __rel: rel,
                  __args: []
                });
              } else {
                queryMapArr[queryMapArr.length - 1][node.name.value] = (currentDef.define || {})[node.name.value] || true;
              }
            }

            return node;
          },
          leave(node, key, parent, path, ancestors) {
            if (ignoreFields.indexOf(node.name.value) > -1) {
              return node;
            }
            if (node.selectionSet && schemaPath.length > 1) {
              schemaPath.pop();
              const data = queryMapArr.pop();
              queryMapArr[queryMapArr.length - 1][node.name.value] = data;
            }
            return node;
          }
        },
        [Kind.ARGUMENT]: {
          enter(node, key, parent, path, ancestors) {
            // convert object field to std obj
            return node;
          },
          leave(node, key, parent, path, ancestors) {

            queryMapArr[queryMapArr.length - 1].__args.push(setArg);
          }
        },
        [Kind.O]
      });
      const queryMap = queryMapArr[0];
      console.log("test", queryMap)

      const a = processDefaultArgs(args);
      let cursor: { index: any; id?: any; } | null = null;
      if (args.after || args.before) {
        cursor = fromCursor(args.after || args.before);
      }
      const { total, models } = await resolveData(source, a, context, info);
      const edges = await Promise.all(models.map(async(row: any, idx: number) => {
        const node = await processAfter(row, a, context, info, definition, Events.OUTPUT);
        if(!node) {
          return undefined;
        }
        let startIndex = null;
        if (cursor) {
          startIndex = Number(cursor.index);
        }
        if (startIndex !== null) {
          startIndex++;
        } else {
          startIndex = 0;
        }
        return {
          cursor: toCursor(name, idx + startIndex),
          node,
        };
      })).then((edges: any) => edges.filter((e: any) => (e !== undefined && e !== null)));
      
      let startCursor, endCursor;
      if (edges.length > 0) {
        startCursor = edges[0].cursor;
        endCursor = edges[edges.length - 1].cursor;
      }
      let hasNextPage = false;
      let hasPreviousPage = false;
      if (args.first || args.last) {
        const count = parseInt(args.first || args.last, 10);
        let index = (!cursor) ? null  : Number(cursor.index);
        if (index !== null) {
          index++;
        } else {
          index = 0;
        }
        hasNextPage = index + 1 + count <= total;
        hasPreviousPage = index - count >= 0;
        if (args.last) {
          [hasNextPage, hasPreviousPage] = [hasPreviousPage, hasNextPage];
        }
      }
      return {
        pageInfo: {
          hasNextPage,
          hasPreviousPage,
          startCursor,
          endCursor,
        },
        total,
        edges,
      };
    }
  };
  schemaCache.lists[name] = response;
  return schemaCache.lists[name];
}

