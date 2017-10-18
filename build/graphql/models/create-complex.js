"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _graphql = require("graphql");

var _graphqlSequelize = require("graphql-sequelize");

var _createBeforeAfter = require("./create-before-after");

var _createBeforeAfter2 = _interopRequireDefault(_createBeforeAfter);

var _resetInterfaces = require("../utils/reset-interfaces");

var _resetInterfaces2 = _interopRequireDefault(_resetInterfaces);

var _getModelDef = require("../utils/get-model-def");

var _getModelDef2 = _interopRequireDefault(_getModelDef);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

// import createBaseModel from "./create-base";


exports.default = (() => {
  var _ref = _asyncToGenerator(function* (models, keys, typeCollection, mutationFunctions, options = {}) {

    yield Promise.all(keys.map((() => {
      var _ref2 = _asyncToGenerator(function* (modelName) {
        if (models[modelName].relationships) {
          if (!typeCollection[modelName]) {
            //target does not exist.. excluded from base types?
            return;
          }
          let { fields } = typeCollection[modelName]._typeConfig; //eslint-disable-line
          yield Promise.all(Object.keys(models[modelName].relationships).map((() => {
            var _ref3 = _asyncToGenerator(function* (relName) {
              let relationship = models[modelName].relationships[relName];
              let targetType = typeCollection[relationship.source];
              let mutationFunction = mutationFunctions[relationship.source];
              // let targetOpts = options[relationship.source];
              if (!targetType) {
                //target does not exist.. excluded from base types?
                return;
              }
              if (options.permission) {
                if (options.permission.relationship) {
                  const result = yield options.permission.relationship(modelName, relName, relationship.source, options.permission.options);
                  if (!result) {
                    return;
                  }
                }
              }
              const { before, after, afterList } = (0, _createBeforeAfter2.default)(models[modelName], options);
              if (!targetType) {
                throw `targetType ${targetType} not defined for relationship`;
              }
              switch (relationship.type) {
                case "belongsToMany": //eslint-disable-line
                case "hasMany":
                  fields[relName] = {
                    type: new _graphql.GraphQLList(targetType),
                    args: Object.assign({}, (0, _graphqlSequelize.defaultListArgs)(), (mutationFunction || {}).fields),
                    resolve: function (source, args, context, info) {
                      // console.log("sassssssss", {
                      //   source,
                      //   args,
                      //   context,
                      //   info,
                      // });
                      return (0, _graphqlSequelize.resolver)(relationship.rel, {
                        before,
                        after: afterList
                      })(source, args, context, info);
                    }
                  };
                  break;
                case "hasOne": //eslint-disable-line
                case "belongsTo":
                  fields[relName] = {
                    type: targetType,
                    resolve: (0, _graphqlSequelize.resolver)(relationship.rel, {
                      before,
                      after
                    })
                  };
                  break;
                default:
                  throw "Unhandled Relationship type";
              }
            });

            return function (_x6) {
              return _ref3.apply(this, arguments);
            };
          })()));
          typeCollection[modelName]._typeConfig.fields = fields; //eslint-disable-line
          (0, _resetInterfaces2.default)(typeCollection[modelName]);
        }
      });

      return function (_x5) {
        return _ref2.apply(this, arguments);
      };
    })()));
    keys.forEach(function (modelName) {
      if (typeCollection[modelName]) {
        typeCollection[`${modelName}[]`] = new _graphql.GraphQLList(typeCollection[modelName]);
      }
    });
    yield Promise.all(keys.map((() => {
      var _ref4 = _asyncToGenerator(function* (modelName) {

        if (!typeCollection[modelName]) {
          //target does not exist.. excluded from base types?
          return;
        }

        const modelDefinition = (0, _getModelDef2.default)(models[modelName]);
        // console.log("found instance methods", {modelName, expose: modelDefinition.expose} );
        if (((modelDefinition.expose || {}).instanceMethods || {}).query) {
          const instanceMethods = modelDefinition.expose.instanceMethods.query;
          // console.log("found instance methods", instanceMethods);
          let { fields } = typeCollection[modelName]._typeConfig; //eslint-disable-line
          yield Promise.all(Object.keys(instanceMethods).map((() => {
            var _ref5 = _asyncToGenerator(function* (methodName) {
              const methodDefinition = instanceMethods[methodName];
              const { type, args } = methodDefinition;
              let targetType = type instanceof String || typeof type === "string" ? typeCollection[type] : type;
              if (!targetType) {
                //target does not exist.. excluded from base types?
                return;
              }
              if (options.permission) {
                if (options.permission.queryInstanceMethods) {
                  const result = yield options.permission.queryInstanceMethods(modelName, methodName, options.permission.options);
                  if (!result) {
                    return;
                  }
                }
              }
              fields[methodName] = {
                type: targetType,
                args,
                resolve: function (source, args, context, info) {
                  return source[methodName].apply(source, [args, context, info]);
                }
              };
            });

            return function (_x8) {
              return _ref5.apply(this, arguments);
            };
          })()));
          typeCollection[modelName]._typeConfig.fields = fields; //eslint-disable-line
          (0, _resetInterfaces2.default)(typeCollection[modelName]);
        }
      });

      return function (_x7) {
        return _ref4.apply(this, arguments);
      };
    })()));
    return typeCollection;
  });

  function createComplexModels(_x, _x2, _x3, _x4) {
    return _ref.apply(this, arguments);
  }

  return createComplexModels;
})();
//# sourceMappingURL=create-complex.js.map