import getModelDefinition from "../utils/get-model-def";
import replaceIdDeep, { replaceDefWhereOperators } from "../utils/replace-id-deep";
import waterfall from "../../utils/waterfall";

/**
 * @typedef {Object} CreateBeforeAfterOutput
 * @property {function} before
 * @property {function} after
 * @property {function[]} afterList
*/

/**
 * @function createBeforeAfter
 * @param {Object} model
 * @param {Object} options
 * @param {Object} hooks
 * @returns {CreateBeforeAfterOutput}
*/

export default function createBeforeAfter(model, options, hooks = {}) {
  let targetBeforeFuncs = [], targetAfterFuncs = [];
  if (hooks.after) {
    targetAfterFuncs = targetAfterFuncs.concat(hooks.after);
  }
  const modelDefinition = getModelDefinition(model);
  const primaryKeys = Object.keys(model.fieldRawAttributesMap).filter((k) => {
    return model.fieldRawAttributesMap[k].primaryKey;
  });
  const foreignKeys = Object.keys(model.fieldRawAttributesMap).filter(k => {
    return !(!model.fieldRawAttributesMap[k].references);
  });
  modelDefinition.globalKeys = primaryKeys.concat(foreignKeys);

  if (options.before) {
    targetBeforeFuncs.push(function(params, args, context, info) {
      return options.before({
        params, args, context, info,
        modelDefinition,
        type: events.QUERY,
      });
    });
  }
  if (options.after) {
    targetAfterFuncs.push(function(result, args, context, info) {
      return options.after({
        result, args, context, info,
        modelDefinition,
        type: events.QUERY,
      });
    });
  }
  if (modelDefinition.before) {
    targetBeforeFuncs.push(function(params, args, context, info) {
      return modelDefinition.before({
        params, args, context, info,
        modelDefinition,
        type: events.QUERY,
      });
    });
  }
  if (modelDefinition.after) {
    targetAfterFuncs.push(function(result, args, context, info) {
      return modelDefinition.after({
        result, args, context, info,
        modelDefinition: modelDefinition,
        type: events.QUERY,
      });
    });
  }
  if (hooks.before) {
    targetBeforeFuncs = targetBeforeFuncs.concat(hooks.before);
  }
  const targetBefore = async(findOptions, args, context, info) => {
    findOptions.context = context;
    findOptions.rootValue = info.rootValue;
    if (findOptions.where) {
      findOptions.where = replaceIdDeep(findOptions.where, modelDefinition.globalKeys, info.variableValues);
    }
    if (targetBeforeFuncs.length === 0) {
      return findOptions;
    }

    return waterfall(targetBeforeFuncs, async(curr, prev) => {
      return curr(prev, args, context, info);
    }, findOptions);
  };
  const targetAfter = (result, args, context, info) => {
    if (targetAfterFuncs.length === 0) {
      return result;
    }
    return waterfall(targetAfterFuncs, async(curr, prev) => {
      const data = await curr(prev, args, context, info);
      if (!data) {
        return undefined;
      }
      if (data.edges) {
        data.edges = data.edges.filter(x => !!x);
      }
      return data;
    }, result);
  };
  const targetAfterArray = (results, args, context, info) => {
    if (targetAfterFuncs.length === 0) {
      return results;
    }
    return waterfall(results, async(result, prev) => {
      return prev.concat(await targetAfter(result, args, context, info));
    }, []);
  };
  const events = {
    before: targetBefore,
    after: targetAfter,
    afterList: targetAfterArray,
  };
  modelDefinition.events = events;

  return events;
}


