import waterfall from "./utils/waterfall";
import {fromGlobalId} from "graphql-relay";
import Cache from "./utils/cache";
import pluralize from "pluralize";
import replaceIdDeep from "./utils/replace-id-deep";
import {capitalize} from "./utils/word";
import events from "./events";
import { Definitions, GqlizeAdapter, GqlizeOptions, Definition, HookMap, Relationship, Model, Association } from './types';
import Events from "./events";

const hookList = [
  "beforeValidate",
  "afterValidate",
  "validationFailed",
  "beforeCreate",
  "afterCreate",
  "beforeDestroy",
  "afterDestroy",
  "beforeRestore",
  "afterRestore",
  "beforeUpdate",
  "afterUpdate",
  "beforeSave",
  "afterSave",
  "beforeUpsert",
  "afterUpsert",
  "beforeBulkCreate",
  "afterBulkCreate",
  "beforeBulkDestroy",
  "afterBulkDestroy",
  "beforeBulkRestore",
  "afterBulkRestore",
  "beforeBulkUpdate",
  "afterBulkUpdate",
  "beforeFind",
  "beforeFindAfterExpandIncludeAll",
  "beforeFindAfterOptions",
  "afterFind",
  "beforeCount",
  "beforeDefine",
  "afterDefine",
  "beforeInit",
  "afterInit",
  "beforeAssociate",
  "afterAssociate",
  "beforeConnect",
  "afterConnect",
  "beforeSync",
  "afterSync",
  "beforeBulkSync",
  "afterBulkSync",
  "beforeQuery",
  "afterQuery",
];

export default class GQLManager {
  
  defs: Definitions;
  defsAdapters: {[name: string]: string};
  adapters: {[name: string]: GqlizeAdapter};
  models: {[name: string]: any};
  relationships: {[name: string]: any};
  globalKeys: {[name: string]: any};
  hooks: {[defName: string]: HookMap};
  hookmap: {[name: string]: any};
  globalHooks: {[name: string]: any};
  // this.reference = {};
  cache:  Cache;
  defaultAdapter: string | undefined;
  constructor(options: GqlizeOptions = {}) {
    this.defs = {};
    this.defsAdapters = {};
    this.adapters = {};
    this.models = {};
    this.relationships = {};
    this.globalKeys = {};
    this.hooks = {};
    this.hookmap = {};
    this.globalHooks = hookList.reduce((o, hookName) => {
      o[hookName] = (options.globalHooks || {})[hookName] || [];
      return o;
    }, {} as {[name: string]: any});
    // this.reference = {};
    this.cache = new Cache();
    this.defaultAdapter = undefined;
  }
  addHook = (hookName: string, hook: any) => {
    this.globalHooks[hookName].push(hook);
  }
  addHookObject = (hooks: { [x: string]: any; }) => {
    return Object.keys(hooks).forEach((h) => {
      const hook = hooks[h];
      return this.addHook(h, hook);
    });
  }
  unshiftHook = (hookName: string, hook: any) => {
    this.globalHooks[hookName].unshift(hook);
  }
  unshiftHookObject = (hooks: { [x: string]: any; }) => {
    return Object.keys(hooks).forEach((h) => {
      const hook = hooks[h];
      return this.unshiftHook(h, hook);
    });
  }
  registerAdapter = (adapter: GqlizeAdapter, overrideName?: string) => {
    if (overrideName) {
      adapter.adapterName = overrideName;
    }    
    if (!this.defaultAdapter) {
      this.defaultAdapter = adapter.adapterName;
    }
    this.adapters[adapter.adapterName] =  adapter;
  }
  getDefinitionHooks = async(defName: any) => {
    const def = this.getDefinition(defName);
    return (def.hooks || def.options?.hooks) || {};
  }
  addDefinition = async(def: Definition, adapterName?: string | undefined) => {
    const datasource = adapterName || def.datasource || this.defaultAdapter
    if(!def.name) {
      throw new Error(`Attempting to add a definition without a name`);
    }
    
    if (this.defs[def.name]) {
      throw new Error(`Model with the name ${def.name} has already been added`);
    }
    if(!datasource) {
      throw new Error(`Model definition does not have a adapter name defined`);
    }
    this.defs[def.name] = def;
    const adapter = this.adapters[datasource];
    this.defsAdapters[def.name] = datasource
    
    // this.hookmap[def.name] = this.generateHookMap(def.name);

    this.hooks[def.name] = hookList.reduce((o, hookName) => {
      o[hookName] = this.createHook(hookName, def);
      return o;
    }, {} as HookMap);

    this.models[def.name] = await adapter.createModel(def, this.hooks[def.name]);
  }

  createHook(hookName: string, def: Definition) {
    return async(first: any, ...args: any) => {
      const hooks = await this.getDefinitionHooks(def.name);
      let v = first;
      if (hooks[hookName]) {
        const hook = hooks[hookName];
        if (Array.isArray(hook)) {
          if (hooks[hookName].length > 0) {
            v = await waterfall(hook, async(hook: (...arg0: any) => any, f: any) => {
              return hook(f, ...args);
            }, v);
          }
        } else  if (hook instanceof Function) {
          v = await hook(v, ...args);
        } 
      }
      if (this.globalHooks[hookName]) {
        if (this.globalHooks[hookName] instanceof Function) {
          v = await this.globalHooks[hookName](def.name, v, ...args);
        } else if (Array.isArray(this.globalHooks[hookName])) {
          if (this.globalHooks[hookName].length > 0) {
            v = await waterfall(this.globalHooks[hookName], async(hook: (defName: any, arg1: any, ...arg2: any) => any, f: any) => {
              return hook(def.name, f, ...args);
            }, v);
          }
        }
      }
      return v;
    };
  }
  getModel = (modelName: string) => {
    return this.getModelAdapter(modelName).getModel(modelName);
  }
  getDefinitions = () => {
    return this.defs;
  }
  getDefinition = (defName: string | number) => {
    return this.defs[defName];
  }
  getGlobalKeys = (defName: any) => {
    const fields = this.getFields(defName);
    return Object.keys(fields).filter((key) => {
      return (fields[key].foreignKey || fields[key].primaryKey) && !fields[key].ignoreGlobalKey;
    });
  }
  getFields = (defName: any) => {
    const adapter = this.getModelAdapter(defName);
    //TODO: add cross adapter fields
    return adapter.getFields(defName);
  }
  getAssociations = (defName: string) => {
    const adapter = this.getModelAdapter(defName);
    //TODO: add cross adapter relationships
    return adapter.getAssociations(defName);
  }
  getGraphQLOutputType = (modelName: string, fieldName: string, type: any) => {
    const adapter = this.getModelAdapter(modelName);
    const typeMapper = adapter.getTypeMapper();
    return typeMapper(type, modelName, fieldName);
  }
  getGraphQLInputType = (modelName: string, fieldName: string, type: any) => {
    const adapter = this.getModelAdapter(modelName);
    const typeMapper = adapter.getTypeMapper();
    return typeMapper(type, modelName, `${fieldName}Input`);
  }
  getModelAdapter = (modelName: string) => {
    const adapterName = this.defsAdapters[modelName];
    return this.adapters[adapterName];
  }
  processRelationship = async(def: Definition, sourceAdapter: GqlizeAdapter , rel: Relationship) => {
    const targetAdapter = this.getModelAdapter(rel.model);
    if(!def.name) {
      throw new Error(`Attempting to use a definition without a name: ${JSON.stringify(def)}`);
    }
    if (!this.relationships[def.name]) {
      this.relationships[def.name] = {};
    }
    if (this.relationships[def.name][rel.name]) {
      throw new Error(`Unable to continue duplicate relationships: ${def.name} - ${rel.name}`);
    }
    this.relationships[def.name][rel.name] = {
      targetAdapter,
      sourceAdapter,
      type: rel.type,
      model: rel.model,
      name: rel.name,
      options: rel.options,
    };
    let {foreignKey} = rel.options;
    if (targetAdapter === sourceAdapter) {
      this.relationships[def.name][rel.name].internal = true;
      //TODO: populate foreignKey/sourceKeys if not provided
      await sourceAdapter.createRelationship(def.name, rel.model, rel.name, rel.type, rel.options);
      // if (!foreignKey) {
      //   throw new Error("TODO: Add foreignKey detection from adapter");
      // }
      return undefined;

    }
    this.relationships[def.name][rel.name].internal = false;
    const modelClass = sourceAdapter.getModel(def.name);
    const sourcePrimaryKeyName = sourceAdapter.getPrimaryKeyNameForModel(def.name)[0]; //TODO: check for edge case with multi primary key table
    let funcName = `get${capitalize(rel.model)}`;
    switch (rel.type) {
      case "hasMany":
        funcName = pluralize.plural(funcName);
        break;
      case "belongsTo":
        funcName = pluralize.singular(funcName);
        break;
    }
    this.relationships[def.name][rel.name].funcName = funcName;
    // const {foreignKey} = rel.options;
    if (!foreignKey) {
      throw new Error(`For cross adapter relationships you must define a foreign key ${def.name} (${rel.type}) ${rel.model}: ${rel.name}`);
    }
    let sourceKey = rel.options?.sourceKey || sourcePrimaryKeyName;
    const findFunc = await targetAdapter.createFunctionForFind(rel.model);
    switch (rel.type) {
      case "hasMany":
        modelClass.prototype[funcName] =
          this.createProxyFunction(targetAdapter, sourceKey, foreignKey, false, findFunc);
        return undefined;
      case "belongsTo":
        modelClass.prototype[funcName] =
          this.createProxyFunction(targetAdapter, foreignKey, sourceKey, true, findFunc);
        return undefined;
    }
    throw new Error(`Unknown relationship type ${rel.type}`);
  }
  createProxyFunction(adapter: GqlizeAdapter, sourceKey: string, filterKey: string, singular: boolean, findFunc: (keyValue: string, filterKey: string, singular: boolean) => ((...args: any) => any))  {
    return function(this: Model) {
      const keyValue = adapter.getValueFromInstance(this, sourceKey);
      return findFunc(keyValue, filterKey, singular)
        .apply(this, Array.from(arguments));
    };
  }
  getValueFromInstance = (defName: any, data: any, keyName: any) => {
    if (!data) {
      return undefined;
    }
    const adapter = this.getModelAdapter(defName);
    return adapter.getValueFromInstance(data, keyName);
  }
  initialise = async(reset = false) => {
    await Promise.all(Object.keys(this.defs).map((defName) => {
      const def = this.defs[defName];
      const sourceAdapter = this.getModelAdapter(defName);
      return waterfall(def.relationships, async(rel: any) =>
        this.processRelationship(def, sourceAdapter, rel));
    }));
    await Promise.all(Object.keys(this.adapters).map((adapterName) => {
      const adapter = this.adapters[adapterName];
      if (reset) {
        return adapter.reset();
      }
      return adapter.initialise();
    }));
  }
  getDefaultListArgs = (defName: string) => {
    const adapter = this.getModelAdapter(defName);
    const definition = this.getDefinition(defName);
    return adapter.getDefaultListArgs(defName, definition);
  }

  getOrderByGraphQLType = (defName: string) => {
    const adapter = this.getModelAdapter(defName);
    const definition = this.getDefinition(defName);
    return adapter.getOrderByGraphQLType(defName, definition);
  }
  getFilterGraphQLType = (defName: string) => {
    const adapter = this.getModelAdapter(defName);
    const definition = this.getDefinition(defName);
    return adapter.getFilterGraphQLType(defName, definition);
  }
  resolveManyRelationship = async(defName: string, association: Association, source: Model, args: any, context: any, info: any) => {

    const options = createGetGraphQLArgsFunc(context, info, source);

    const adapter = this.getModelAdapter(defName);
    const definition = this.getDefinition(defName);
    const a = await adapter.replaceIdInArgs(args, defName, info.variableValues);
    // const argNames = adapter.getAllArgsToReplaceId();
    // const globalKeys = this.getGlobalKeys(defName);
    // const a = Object.keys(args).reduce((o, key) => {
    //   if (argNames.indexOf(key) > -1) {
    //     o[key] = replaceIdDeep(args[key], globalKeys, info.variableValues);
    //   } else {
    //     o[key] = args[key];
    //   }
    //   return o;
    // }, {});

    let offset;
    if (args.after) {
      offset = args.after.index + 1;
    } else if (args.before) {
      offset = args.before.index + 1;
      if (args.limit) {
        offset -= Number(args.limit);
      }
    }
    return adapter.resolveManyRelationship(defName, association, source, a, offset, definition.whereOperators, info, options);
  }
  resolveSingleRelationship = async(defName: string, association: Association, source: any, args: any, context: any, info: any) => {
    const adapter = this.getModelAdapter(defName);
    const options = createGetGraphQLArgsFunc(context, info, source);
    return adapter.resolveSingleRelationship(defName, association, source, args, context, info, options);
  }
  resolveFindAll = async(defName: any, source: any, args: { after: { index: number; }; before: { index: number; }; limit: any; }, context: any, info: { variableValues: any; fieldNodes: any[]; }) => {
    const definition = this.getDefinition(defName);
    const adapter = this.getModelAdapter(defName);
    const a = await adapter.replaceIdInArgs(args, defName, info.variableValues);
    // const argNames = adapter.getAllArgsToReplaceId();

    let selectedFields = [];
    if (info) {
      if (Array.isArray(info.fieldNodes)) {
        selectedFields = getSelectionFields(info.fieldNodes[0]);
      }
    }
    let offset;
    if (args.after) {
      offset = args.after.index + 1;
    } else if (args.before) {
      offset = args.before.index + 1;
      if (args.limit) {
        offset -= Number(args.limit);
      }
    }
    const {getOptions, countOptions} = await adapter.processListArgsToOptions(defName, a, offset, info, definition.whereOperators, createGetGraphQLArgsFunc(context, info, source), selectedFields);
    if (definition.before) {
      await definition.before({
        params: getOptions, args, context, info,
        modelDefinition: definition,
        type: Events.QUERY,
      });
    }
    let models = await adapter.findAll(defName, getOptions);

    if (definition.after) {
      const afterFunc = definition.after;
      models = await Promise.all(models.map((m: any) => afterFunc({
        result: m, args, context, info,
        modelDefinition: definition,
        type: events.QUERY,
      })).filter((m: any) => (m !== undefined && m !== null)));
    }
    let total;
    if (adapter.hasInlineCountFeature()) {
      total = await adapter.getInlineCount(models);
    } else {
      total = await adapter.count(defName, countOptions);
    }
    return {
      total, models,
    };
  }
  resolveClassMethod = (defName: any, methodName: string | number, args: any, context: any) => {
    const Model = this.getModel(defName);
    //TODO: add before/after events?
    return Model[methodName](args, context);
  }

  processInputs = async(defName: any, input: { [x: string]: any; }, args: any, context: any, info: any, model?: any) => {
    const definition = this.getDefinition(defName);
    let i = Object.keys(this.getFields(defName)).reduce((o, key) => {
      if (input[key] !== undefined) {
        o[key] = input[key];
      }
      return o;
    }, {} as any);

    if (definition.override) {
      i = await waterfall(Object.keys(definition.override), async(key: string | number, o: { [x: string]: any; }) => {
        if (definition.override) {
          const input = definition.override[key].input;
          if (input) {
            const val = await input(o[key], args, context, info, model);
            if (val !== undefined) {
              o[key] = val;
            }
          }
        }
        return o;
      }, i);
    }
    return i;
  }
  processRelationshipMutation = async(defName: any, source: any, input: any, context: any, info: { variableValues: any; }) => {
    const associations = this.getAssociations(defName);
    const defaultOptions = createGetGraphQLArgsFunc(context, info, source);
    await waterfall(Object.keys(associations), async(key: string, o: any) => {
      const association = associations[key];
      const targetName = association.target;
      const targetAdapter = this.getModelAdapter(targetName);
      const targetGlobalKeys = this.getGlobalKeys(targetName);
      const targetDef = this.getDefinition(targetName);
      if (input[key]) {
        const args = input[key];
        if (args.create) {
          await waterfall(args.create, async(arg: any) => {
            const [result] = await this.processCreate(targetName, source, {input: arg}, context, info);
            // const targetAdapter = this.getModelAdapter(targetName);
            // const k = this.getValueFromInstance(targetName, result, targetAdapter.getPrimaryKeyNameForModel(targetName));
            switch (association.associationType) {
              case "hasMany":
              case "belongsToMany":
                await source[association.accessors.add](result, defaultOptions);
                break;
              default:
                await source[association.accessors.set](result, defaultOptions);
                break;
            }

            // await this.processRelationshipMutation(targetDef, result, input, context, info);
          });
        }
        if (args.update) {
          await waterfall(args.update, async(arg: { where: any; limit: any; input: any; }) => {
            const {where, limit, input} = arg;
            // const [result] = await this.processUpdate(targetName, source, {input: arg}, context, info);
            const whereObj = await targetAdapter.processFilterArgument(replaceIdDeep(where, targetGlobalKeys, info.variableValues), targetDef.whereOperators);
            const targets = await source[association.accessors.get]({
              limit,
              where: whereObj,
              ...defaultOptions
            });
            let i = await this.processInputs(targetName, input, source, args, context, info);
            if (targetDef.before) {
              i = await targetDef.before({
                params: input, args, context, info,
                modelDefinition: targetDef,
                type: events.MUTATION_UPDATE,
              });
            }
            await Promise.all(targets.map(async(model: any) => {
              let m = await targetAdapter.update(model, i, defaultOptions);
              if (targetDef.after) {
                m = await targetDef.after({
                  result: m, args, context, info,
                  modelDefinition: targetDef,
                  type: events.MUTATION_UPDATE,
                });
              }
              const defName = targetDef.name;
              await this.processRelationshipMutation(defName, m, input, context, info);
              return m;
            }));
          });
        }
        if (args.delete) {
          await waterfall(args.delete, async(arg: any) => {
            const targets = await source[association.accessors.get](Object.assign({
              where: await targetAdapter.processFilterArgument(replaceIdDeep(arg, targetGlobalKeys, info.variableValues), targetDef.whereOperators),
            }, defaultOptions));
            // let i = await this.processInputs(targetName, input, source, args, context, info);
            await Promise.all(targets.map(async(model: any) => {
              const defName = targetDef.name;
              await this.processRelationshipMutation(defName, model, input, context, info);
              if (targetDef.before) {
                await targetDef.before({
                  params: model, args, context, info,
                  model, modelDefinition: targetDef,
                  type: events.MUTATION_DELETE,
                });
              }
              await this.processDelete(defName, source, arg, context, info);
              if (targetDef.after) {
                await targetDef.after({
                  result: model, args, context, info,
                  modelDefinition: targetDef,
                  type: events.MUTATION_DELETE,
                });
              }
              return model;
            }));
          });
        }
        if (args.remove) {
          await waterfall(args.remove, async(arg: any) => {
            const where = await targetAdapter.processFilterArgument(replaceIdDeep(arg, targetGlobalKeys, info.variableValues), targetDef.whereOperators);
            const results = await targetAdapter.findAll(targetName, Object.assign({
              where,
            }, defaultOptions));
            if (results.length > 0) {
              return source[association.accessors.removeMultiple](results, defaultOptions);
            }
            return undefined;
          });
        }

        if (args.add) {
          await waterfall(args.add, async(arg: any) => {
            const where = await targetAdapter.processFilterArgument(replaceIdDeep(arg, targetGlobalKeys, info.variableValues), targetDef.whereOperators);
            const results = await targetAdapter.findAll(targetName, Object.assign({
              where,
            }, defaultOptions));
            if (results.length > 0) {
              return source[association.accessors.addMultiple](results, defaultOptions);
            }
            return undefined;
          });
        }
      }
    });
    return source;
  }
  processCreate = async(defName: any, source: any, args: { input: any; }, context: any, info: { variableValues: any; }) => {
    const adapter = this.getModelAdapter(defName);
    const definition = this.getDefinition(defName);
    const processCreate = adapter.getCreateFunction(defName);
    const globalKeys = this.getGlobalKeys(defName);
    let i = await this.processInputs(defName, args.input, args, context, info);
    let input = replaceIdDeep(i, globalKeys, info.variableValues);
    if (definition.before) {
      input = await definition.before({
        params: input, args, context, info,
        modelDefinition: definition,
        type: events.MUTATION_CREATE,
      });
    }
    let result;
    if (Object.keys(input).length > 0) {
      result = await processCreate(input, createGetGraphQLArgsFunc(context, info, source));
      if (definition.after) {
        result = definition.after({
          result, args, context, info,
          modelDefinition: definition,
          type: events.MUTATION_CREATE,
        });
      }

      if (result !== undefined && result !== null) {
        result = await this.processRelationshipMutation(defName, result, args.input, context, info);
        return [result];
      }

    }
    return [];
  }

  processUpdate = async(defName: any, source: any, args: { input: { [x: string]: any; }; where: any; limit: any; }, context: any, info: { variableValues: any; }) => {
    const definition = this.getDefinition(defName);
    const adapter = this.getModelAdapter(defName);
    const processUpdate = adapter.getUpdateFunction(defName, definition.whereOperators);
    const globalKeys = this.getGlobalKeys(defName);

    let i = Object.keys(args.input).reduce((o, k) => {
      if (globalKeys.indexOf(k) > -1) {
        let v = args.input[k];
        if (typeof args.input[k] === "function") {
          v = args.input[k](info.variableValues);
        }
        if (v === null || v === undefined) {
          o[k] = null;
        } else {
          o[k] = fromGlobalId(v).id;
        }
        //o[k] = fromGlobalId(v).id;
      } else {
        o[k] = args.input[k];
      }
      return o;
    }, {} as any);
    const where = replaceIdDeep(args.where, globalKeys, info.variableValues);
    if (definition.before) {
      i = await definition.before({
        params: i, args, context, info,
        modelDefinition: definition,
        type: events.MUTATION_UPDATE,
      });
    }
    const results = await processUpdate(where, (model: any) => {
      return this.processInputs(defName, i, args, context, info, model);
    }, createGetGraphQLArgsFunc(context, info, source, {limit: args.limit}));

    await waterfall(results, async(r: any) => {
      await this.processRelationshipMutation(defName, r, args.input, context, info);
      if (definition.after) {
        await definition.after({
          result: r, args, context, info,
          modelDefinition: definition,
          type: events.MUTATION_UPDATE,
        });
      }
    });

    return results;
  }
  processDelete = async(defName: any, source: any, args: any, context: any, info: { variableValues: any; }) => {
    const definition = this.getDefinition(defName);
    const adapter = this.getModelAdapter(defName);
    const processDelete = adapter.getDeleteFunction(defName, definition.whereOperators);
    const globalKeys = this.getGlobalKeys(defName);
    const where = replaceIdDeep(args, globalKeys, info.variableValues);
    const before = (model: any) => {
      if (!definition.before) {
        return model;
      }
      return definition.before({
        params: model, args, context, info,
        model, modelDefinition: definition,
        type: events.MUTATION_DELETE,
      });
    };
    const after = (model: any) => {
      if (!definition.after) {
        return model;
      }
      return definition.after({
        result: model, args, context, info,
        modelDefinition: definition,
        type: events.MUTATION_DELETE,
      });
    };
    return processDelete(where, createGetGraphQLArgsFunc(context, info, source), before, after);
  }

  isTypeOf = (defName: any, definition: any, value: any) => {
    const Model = this.getModel(defName) as any;
    const isType = value instanceof Model;
    return isType;
  }

}


function createGetGraphQLArgsFunc(context: any, info: any, source: any, options = {}) {
  return Object.assign({
    getGraphQLArgs() {
      return {
        context,
        info,
        source,
      };
    },
  }, options);
}

function getSelectionFields(startNode: any, targetName?: string) {
  const targetNode = getSelectionSet(startNode, targetName);
  if (targetNode) {
    if (targetNode.selectionSet) {
      return targetNode.selectionSet.selections.reduce((o: any[], k: { name: { value: any; }; }) => {
        o.push(k.name.value);
        return o;
      }, []);
    }
  }
  return undefined;
}


function getSelectionSet(node:any, selectionSet: any, targetName:string = "node"): any {
  if (!node) {
    return undefined;
  }
  if (node.name.value === targetName) {
    return node;
  }
  if (!node.selectionSet) {
    return undefined;
  }
  if (!Array.isArray(node.selectionSet.selections)) {
    return undefined;
  }
  for (let i = 0; i < node.selectionSet.selections.length; i++) {
    const result = getSelectionSet(node.selectionSet.selections[i], targetName);
    if (result) {
      return result;
    }
  }
  return undefined;
}



// function generateHooks(hooks = [], schemaName) {
//   return hooks.reduce((o, h) => {
//     Object.keys(h).forEach((hookName) => {
//       if (!o[hookName]) {
//         o[hookName] = createHookQueue(hookName, hooks, schemaName);
//       }
//     });
//     return o;
//   }, {});
// }

// function createHookQueue(hookName, hooks, schemaName) {
//   return function(init, options, error) {
//     return hooks.reduce((promise, targetHooks) => {
//       return promise.then(async(val) => {
//         if (targetHooks[hookName]) {
//           let result;
//           if (Array.isArray(targetHooks[hookName])) {
//             result = await waterfall(targetHooks[hookName], (hook, prevResult) => {
//               return hook(prevResult, options, error, schemaName, hookName);
//             }, val);
//           } else {
//             result = await targetHooks[hookName](val, options, error, schemaName, hookName);
//           }
//           if (result) {
//             return result;
//           }
//         }
//         return val;
//       });
//     }, Promise.resolve(init));
//   };
// }
