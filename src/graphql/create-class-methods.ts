
import waterfall from "../utils/waterfall";

import {
  GraphQLObjectType,
} from "graphql";

import { capitalize } from "../utils/word";
import GQLManager from '../manager';
import { Definitions, GqlizeOptions, SchemaCache, Definition } from '../types';



export default function createClassMethods(instance: GQLManager, definitions: Definitions, options: GqlizeOptions, schemaCache: SchemaCache, targetName = "query") {
  return async(defName: string, o: any) => {
    const definition = definitions[defName];
    let target;
    switch(targetName) {
      case "query": 
        target = definition.expose?.classMethods?.query;
        break;
      case "mutations":
        target = definition.expose?.classMethods?.mutations;
        break;
    }
    if (target) {
      const obj = await createClassMethodFields(instance, defName, definition, target, options, schemaCache, targetName);
      if (Object.keys(obj).length > 0) {
        o[defName] = {
          type: new GraphQLObjectType({
            name: `${defName}${capitalize(targetName)}ClassMethods`,
            fields: obj,
          }),
          resolve() {
            return {};
          }
        };
      }
    }
    return o;
  };
}

export function createClassMethodFields(instance: GQLManager, defName: string, definition: Definition, query: {
  [x: string]: { 
    type: any; 
    args?: any; 
    before?: any;
    after?: any;
  };
}, options: GqlizeOptions, schemaCache: SchemaCache, targetName: string) {
  return waterfall(Object.keys(query), async(methodName: string, o: { 
    [x: string]: {
      type: any;
      args: any;
      description: any;
      resolve(source: any, args: any, context: any, info: any): Promise<any>; 
    };
  }) => {
    if (options.permission) {
      if (options.permission.queryClassMethods && targetName === "query") {
        const result = await options.permission.queryClassMethods(defName, methodName, options.permission.options);
        if (!result) {
          return o;
        }
      } else if (options.permission.mutationClassMethods && targetName === "mutations") {
        const result = await options.permission.mutationClassMethods(defName, methodName, options.permission.options);
        if (!result) {
          return o;
        }
      }
    }
    const {type, args, before, after} = query[methodName];
    let outputType = (typeof type === "string") ? schemaCache.types[type] : type;
    if (!outputType) {
      return o;
    }
    let newArgs;
    if (args) {
      newArgs = Object.keys(args).reduce((oa, argName) => {
        let arg = args[argName];
        let argType = (arg.type instanceof String || typeof arg.type === "string") ? schemaCache.mutationInputFields[arg.type] : arg.type;
        if (argType) {
          oa[argName] = {
            ...arg,
            type: argType,
          };
        }
        return oa;
      }, {} as any);
    }

    o[methodName] = {
      type: outputType,
      args: newArgs,
      description: (definition.comments?.classMethods || {})[methodName],
      async resolve(source: any, args: any, context: any, info: any) {
        return instance.resolveClassMethod(defName, methodName, args, context, before, after);
      },
    };
    return o;

  }, {});
}
