
import createListObject from "./create-list-object";
import {GraphQLList} from "graphql";
import waterfall from "../utils/waterfall";
import GQLManager from '../manager';
import { SchemaCache } from '../types';
import { processAfter } from "./utils/after";
import Events from "../events";

export default function createMutationModel(instance: GQLManager, defName: string, schemaCache: SchemaCache, create: any, update: any, del: any) {

  const input = schemaCache.mutationInputs[defName];
  const definition = instance.getDefinition(defName);
  let inp: any = {};
  if (create) {
    inp.create = {
      type: input.create,
      description: `This will create a new element for ${defName}`,
    };
  }
  if (update) {
    inp.update = {
      type: input.update,
      description: `This will update a new element for ${defName}`,
    };
  }
  if (del) {
    inp.delete = {
      type: input.delete,
      description: `This will delete a new element for ${defName}`,
    };
  }
  return {
    type: new GraphQLList(schemaCache.types[defName]),
    args: inp,
    async resolve(source: any, args: any, context: any, info: any) {
      // console.log({source, args, context, info});
      let results:any[] = [];

      if (args.create) {
        results = await waterfall(args.create, async(arg, arr) => {
          const result = await instance.processCreate(defName, source, {input: arg}, context, info);
          const node = await processAfter(result, args, context, info, definition, Events.MUTATION_CREATE);
          return arr.concat(node);
        }, results);
      }
      if (args.update) {
        results = await waterfall(args.update, async(arg, arr) => {
          const result = await instance.processUpdate(defName, source, arg, context, info);
          const node = await waterfall(result, (el: any) => processAfter(el, args, context, info, definition, Events.MUTATION_UPDATE));
          return arr.concat(node);
        }, results);
      }
      if (args.delete) {
        results = await waterfall(args.delete, async(arg, arr) => {
          const result = await instance.processDelete(defName, source, arg, context, info);
          const node = await waterfall(result, (el: any) => processAfter(el, args, context, info, definition, Events.MUTATION_DELETE));
          return arr.concat(node);
        }, results);
      }
      // if (!(args.create || args.update || args.delete) || args.where) {
      //   return resolver(models[modelName], {
      //     before,
      //     after,
      //   })(source, args, context, info);
      // }
      return results;
    }
  };
}
