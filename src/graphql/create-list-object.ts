
import pageInfo from "./objects/page-info";
import {
  GraphQLObjectType,
  GraphQLList,
  GraphQLInt,
  GraphQLString,
} from "graphql";

import { fromCursor, toCursor } from "./objects/cursor";
import {capitalize} from "../utils/word";
import { SchemaCache } from '../types';
import GQLManager from "../manager";

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
      const a = processDefaultArgs(args);
      let cursor: { index: any; id?: any; } | null = null;
      if (args.after || args.before) {
        cursor = fromCursor(args.after || args.before);
      }
      const { total, models } = await resolveData(source, a, context, info);
      const edges = models.map((row: any, idx: number) => {
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
          node: row,
        };
      });

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

