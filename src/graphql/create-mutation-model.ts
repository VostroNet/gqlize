
import createListObject from "./create-list-object";
import {GraphQLList} from "graphql";
import waterfall from "../utils/waterfall";
import GQLManager from '../manager';
import { SchemaCache } from '../types';

export default function createMutationModel(instance: GQLManager, defName: string, schemaCache: SchemaCache, create: any, update: any, del: any) {

  const input = schemaCache.mutationInputs[defName];
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
          return arr.concat(result);
        }, results);
      }
      if (args.update) {
        results = await waterfall(args.update, async(arg, arr) => {
          const result = await instance.processUpdate(defName, source, arg, context, info);
          return arr.concat(result);
        }, results);
      }
      if (args.delete) {
        results = await waterfall(args.delete, async(arg, arr) => {
          const result = await instance.processDelete(defName, source, arg, context, info);
          return arr.concat(result);
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
