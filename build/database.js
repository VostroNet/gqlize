"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = connect;

var _sequelize = require("sequelize");

var _sequelize2 = _interopRequireDefault(_sequelize);

var _logger = require("./utils/logger");

var _logger2 = _interopRequireDefault(_logger);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var log = (0, _logger2.default)("seeql::database:");

function connect(schemas, instance, options) {
  loadSchemas(schemas, instance);
  return instance;
}

function loadSchemas(schemas, instance) {
  var options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  var defaultAttr = options.defaultAttr,
      defaultModel = options.defaultModel;

  schemas.forEach(function (schema) {
    instance.define(schema.name, Object.assign({}, defaultAttr, schema.define), Object.assign({}, defaultModel, schema.options));
    instance.models[schema.name].$gqlsql = schema;
    if (/^4/.test(_sequelize2.default.version) && schema.options) {
      var _schema$options = schema.options,
          classMethods = _schema$options.classMethods,
          instanceMethods = _schema$options.instanceMethods;

      if (classMethods) {
        Object.keys(classMethods).forEach(function (classMethod) {
          instance.models[schema.name][classMethod] = classMethods[classMethod];
        });
      }
      if (instanceMethods) {
        Object.keys(instanceMethods).forEach(function (instanceMethod) {
          instance.models[schema.name].prototype[instanceMethod] = instanceMethods[instanceMethod];
        });
      }
    }
  });
  schemas.forEach(function (schema) {
    (schema.relationships || []).forEach(function (relationship) {
      createRelationship(instance, schema.name, relationship.model, relationship.name, relationship.type, Object.assign({ as: relationship.name }, relationship.options));
    });
  });
}

function createRelationship(instance, targetModel, sourceModel, name, type) {
  var options = arguments.length > 5 && arguments[5] !== undefined ? arguments[5] : {};

  var model = instance.models[targetModel];
  if (!model.relationships) {
    model.relationships = {};
  }
  try {
    model.relationships[name] = {
      type: type,
      source: sourceModel,
      target: targetModel,
      rel: model[type](instance.models[sourceModel], options)
    };
  } catch (err) {
    log.error("Error Mapping relationship", { model: model, sourceModel: sourceModel, name: name, type: type, options: options, err: err });
  }
  instance.models[targetModel] = model;
}
//# sourceMappingURL=database.js.map
