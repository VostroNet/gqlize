"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = createModelTypes;

var _graphql = require("graphql");

var _graphqlSequelize = require("graphql-sequelize");

var _getModelDef = _interopRequireDefault(require("../utils/get-model-def"));

var _createBeforeAfter = _interopRequireDefault(require("./create-before-after"));

var _processFk = _interopRequireDefault(require("../utils/process-fk"));

var _node = require("graphql-relay/lib/node/node");

var _models = require("../utils/models");

var _replaceWhereOperators = require("graphql-sequelize/lib/replaceWhereOperators");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; var ownKeys = Object.keys(source); if (typeof Object.getOwnPropertySymbols === 'function') { ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function (sym) { return Object.getOwnPropertyDescriptor(source, sym).enumerable; })); } ownKeys.forEach(function (key) { _defineProperty(target, key, source[key]); }); } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

const {
  sequelizeConnection
} = _graphqlSequelize.relay;

async function createModelTypes(models, keys, prefix = "", options, nodeInterface) {
  const result = await keys.reduce((promise, modelName) => {
    return promise.then(async o => {
      o[modelName] = await createModelType(modelName, models, prefix, options, nodeInterface, o);
      return o;
    });
  }, Promise.resolve({}));
  return result;
}

async function createModelType(modelName, models, prefix = "", options = {}, nodeInterface, typeCollection) {
  if (options.permission) {
    if (options.permission.model) {
      const result = await options.permission.model(modelName);

      if (!result) {
        return undefined;
      }
    }
  }

  const model = models[modelName];
  const {
    before,
    after
  } = (0, _createBeforeAfter.default)(models[modelName], options); //eslint-disable-line

  const modelDefinition = (0, _getModelDef.default)(model);

  function basicFields() {
    if (typeCollection[`${modelName}`].$sql2gql.fields.basic) {
      return typeCollection[`${modelName}`].$sql2gql.fields.basic;
    }

    let exclude = Object.keys(modelDefinition.override || {}).concat(modelDefinition.ignoreFields || []);

    if (options.permission) {
      if (options.permission.field) {
        exclude = exclude.concat(Object.keys(model.rawAttributes).filter(keyName => !options.permission.field(modelName, keyName)));
      }
    }

    let fieldDefinitions = (0, _graphqlSequelize.attributeFields)(model, {
      exclude,
      globalId: true //TODO: need to add check for primaryKey field as exclude ignores it if this is true.

    });
    const foreignKeys = (0, _models.getForeignKeysForModel)(model);

    if (foreignKeys.length > 0) {
      foreignKeys.forEach(fk => {
        if (!fieldDefinitions[fk]) {
          return;
        }

        const attr = model.fieldRawAttributesMap[fk];
        fieldDefinitions[fk] = {
          // description: 'The ID of an object',
          type: attr.allowNull ? _graphql.GraphQLID : new _graphql.GraphQLNonNull(_graphql.GraphQLID),
          resolve: createForeignKeyResolver(attr.Model.name, fk)
        };
      });
    }

    if (modelDefinition.override) {
      Object.keys(modelDefinition.override).forEach(fieldName => {
        if (options.permission) {
          if (options.permission.field) {
            if (!options.permission.field(modelName, fieldName)) {
              return;
            }
          }
        }

        const fieldDefinition = modelDefinition.define[fieldName];

        if (!fieldDefinition) {
          throw new Error(`Unable to find the field definition for ${modelName}->${fieldName}. Please check your model definition for invalid configuration.`);
        }

        const overrideFieldDefinition = modelDefinition.override[fieldName];
        let type;

        if (!(overrideFieldDefinition.type instanceof _graphql.GraphQLObjectType) && !(overrideFieldDefinition.type instanceof _graphql.GraphQLScalarType) && !(overrideFieldDefinition.type instanceof _graphql.GraphQLEnumType)) {
          type = new _graphql.GraphQLObjectType(overrideFieldDefinition.type);
        } else {
          type = overrideFieldDefinition.type;
        }

        if (!fieldDefinition.allowNull) {
          type = new _graphql.GraphQLNonNull(type);
        }

        fieldDefinitions[fieldName] = {
          type,
          resolve: overrideFieldDefinition.output
        };
      });
    }

    typeCollection[`${modelName}`].$sql2gql.fields.basic = fieldDefinitions;
    return fieldDefinitions;
  }

  function relatedFields() {
    if (typeCollection[`${modelName}`].$sql2gql.fields.related) {
      return typeCollection[`${modelName}`].$sql2gql.fields.related;
    }

    let fieldDefinitions = {};

    if (models[modelName].relationships) {
      if (typeCollection[modelName]) {
        Object.keys(models[modelName].relationships).forEach(relName => {
          let relationship = models[modelName].relationships[relName];
          let targetType = typeCollection[relationship.source];
          const model = models[modelName];
          const assoc = model.associations[relName];

          if (!targetType) {
            return;
          }

          if (options.permission) {
            if (options.permission.relationship) {
              const result = options.permission.relationship(modelName, relName, relationship.source, options.permission.options); //TODO move this outside to resolve via promise

              if (!result) {
                return;
              }
            }
          }

          if (!targetType) {
            throw `targetType ${targetType} not defined for relationship`;
          }

          const modelDefinition = (0, _getModelDef.default)(models[targetType.name]); //TODO change this to read the complex and basic fields, this goes around permissions
          // const orderByValues = Object.keys(modelDefinition.define).reduce((obj, field) => {
          //   return Object.assign({}, obj, {
          //     [`${field}Asc`]: {value: [field, "ASC"]},
          //     [`${field}Desc`]: {value: [field, "DESC"]},
          //   });
          // }, {
          //   idAsc: {value: ["id", "ASC"]},
          //   idDesc: {value: ["id", "DESC"]},
          //   createdAtAsc: {value: ["createdAt", "ASC"]},
          //   createdAtDesc: {value: ["createdAt", "DESC"]},
          //   updatedAtAsc: {value: ["updatedAt", "ASC"]},
          //   updatedAtDesc: {value: ["updatedAt", "DESC"]},
          // });

          const {
            basic
          } = typeCollection[modelName].$sql2gql.fields;
          const values = Object.keys(basic).reduce((o, key) => {
            o[`${key}ASC`] = {
              value: [key, "ASC"]
            };
            o[`${key}DESC`] = {
              value: [key, "DESC"]
            };
            return o;
          }, {});
          const relationMap = modelDefinition.relationships.reduce((o, r) => {
            o[r.name] = r.model;
            return o;
          }, {});
          let include;

          if (modelDefinition.relationships.length > 0) {
            include = new _graphql.GraphQLList(new _graphql.GraphQLInputObjectType({
              name: `${modelName}${relName}Include`,

              fields() {
                const relatedFields = typeCollection[targetType.name].$sql2gql.relatedFields();
                const complexKeys = Object.keys(relatedFields);

                if (complexKeys.length === 0) {
                  return undefined;
                }

                return {
                  relName: {
                    type: new _graphql.GraphQLEnumType({
                      name: `${modelName}${relName}IncludeEnum`,
                      values: Object.keys(relatedFields).reduce((o, k) => {
                        o[k] = {
                          value: k
                        };
                        return o;
                      }, {})
                    })
                  },
                  where: {
                    type: _graphqlSequelize.JSONType.default
                  },
                  required: {
                    type: _graphql.GraphQLBoolean
                  }
                };
              }

            }));
          }

          let conn = sequelizeConnection({
            name: `${modelName}${relName}`,
            nodeType: targetType,
            target: relationship.rel,
            connectionFields: {
              total: {
                type: _graphql.GraphQLInt,

                async resolve({
                  source
                }, args, context, info) {
                  return source[assoc.accessors.count].apply(source, [{
                    where: args.where,
                    context,
                    info
                  }]);
                }

              }
            },
            orderBy: new _graphql.GraphQLEnumType({
              name: `${modelName}${relName}OrderBy`,
              values: Object.assign({}, values, modelDefinition.orderBy)
            }),
            where: (key, value, currentWhere) => {
              // for custom args other than connectionArgs return a sequelize where parameter
              if (key === "include") {
                return currentWhere;
              }

              if (key === "where") {
                return value;
              }

              return {
                [key]: value
              };
            },

            async before(findOptions, args, context, info) {
              const options = await before(findOptions, args, context, info);
              const {
                source
              } = info;

              if (options.dataloader) {
                findOptions = Object.assign(findOptions, options.dataloader);
              }

              const fk = source.get(assoc.sourceKey);
              options.where = {
                $and: [{
                  [assoc.foreignKey]: fk
                }, options.where]
              };

              if (args.include) {
                options.include = args.include.map(i => {
                  const {
                    relName,
                    where,
                    required
                  } = i;
                  return {
                    as: relName,
                    model: models[relationMap[relName]],
                    where: where ? (0, _replaceWhereOperators.replaceWhereOperators)(where) : undefined,
                    required
                  };
                });
              }

              return options;
            },

            after
          });
          let bc;

          switch (relationship.type) {
            case "belongsToMany":
              //eslint-disable-line
              bc = sequelizeConnection({
                name: `${modelName}${relName}`,
                nodeType: targetType,
                target: relationship.rel,
                connectionFields: {
                  total: {
                    type: _graphql.GraphQLInt,

                    async resolve({
                      source
                    }, args, context, info) {
                      return source[assoc.accessors.count].apply(source, [{
                        where: args.where,
                        context,
                        info
                      }]);
                    }

                  }
                },
                where: (key, value, currentWhere) => {
                  if (key === "include") {
                    return currentWhere;
                  }

                  if (key === "where") {
                    return value;
                  }

                  return {
                    [key]: value
                  };
                },

                before(findOptions, args, context, info) {
                  const model = models[modelName];
                  const assoc = model.associations[relName];

                  if (options.dataloader) {
                    findOptions = Object.assign(findOptions, options.dataloader);
                  }

                  if (!findOptions.include) {
                    findOptions.include = [];
                  }

                  let inc;

                  if (args.include) {
                    inc = args.include.map(i => {
                      const {
                        relName,
                        where,
                        required
                      } = i;
                      return {
                        as: relName,
                        model: models[relationMap[relName]],
                        where: where ? (0, _replaceWhereOperators.replaceWhereOperators)(where) : undefined,
                        required
                      };
                    });
                  }

                  if (!assoc.paired) {
                    throw new Error(`${modelName} ${relName} .paired missing on belongsToMany association. You need to set up both sides of the association`);
                  }

                  let b2mInc = {
                    model: assoc.source,
                    as: assoc.paired.as
                  };

                  if (inc) {
                    b2mInc.include = inc;
                  }

                  findOptions.include.push(b2mInc);

                  if (findOptions.where) {
                    findOptions.where = (0, _replaceWhereOperators.replaceWhereOperators)(findOptions.where);
                  }

                  return before(findOptions, args, context, info);
                },

                after
              });
              fieldDefinitions[relName] = {
                type: bc.connectionType,
                args: _objectSpread({}, bc.connectionArgs, {
                  where: {
                    type: _graphqlSequelize.JSONType.default
                  }
                }),
                resolve: bc.resolve
              };
              break;

            case "hasMany":
              fieldDefinitions[relName] = {
                type: conn.connectionType,
                args: _objectSpread({}, conn.connectionArgs, {
                  where: {
                    type: _graphqlSequelize.JSONType.default
                  }
                }),
                resolve: conn.resolve
              };
              break;

            case "hasOne": //eslint-disable-line

            case "belongsTo":
              fieldDefinitions[relName] = {
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

          if (include && fieldDefinitions[relName].args) {
            fieldDefinitions[relName].args.include = {
              type: include
            };
          }
        });
      }
    }

    return fieldDefinitions;
  }

  function complexFields() {
    if (typeCollection[`${modelName}`].$sql2gql.fields.complex) {
      return typeCollection[`${modelName}`].$sql2gql.fields.complex;
    }

    let fieldDefinitions = {};

    if (((modelDefinition.expose || {}).instanceMethods || {}).query) {
      const instanceMethods = modelDefinition.expose.instanceMethods.query;
      Object.keys(instanceMethods).forEach(methodName => {
        const {
          type,
          args
        } = instanceMethods[methodName];
        let targetType = type instanceof String || typeof type === "string" ? typeCollection[type] : type;

        if (!targetType) {
          //target does not exist.. excluded from base types?
          return;
        }

        if (options.permission) {
          if (options.permission.queryInstanceMethods) {
            const result = options.permission.queryInstanceMethods(modelName, methodName, options.permission.options);

            if (!result) {
              return;
            }
          }
        }

        fieldDefinitions[methodName] = {
          type: targetType,
          args,

          async resolve(source, args, context, info) {
            return (0, _processFk.default)(targetType, source[methodName], source, args, context, info);
          }

        };
      });
    }

    typeCollection[`${modelName}`].$sql2gql.fields.complex = fieldDefinitions;
    return fieldDefinitions;
  }

  const obj = new _graphql.GraphQLObjectType({
    name: `${prefix}${modelName}`,
    description: "",

    fields() {
      return Object.assign({}, basicFields(), relatedFields(), complexFields());
    },

    interfaces: [nodeInterface]
  });
  obj.$sql2gql = {
    basicFields: basicFields,
    complexFields: complexFields,
    relatedFields: relatedFields,
    fields: {},
    events: {
      before,
      after
    }
  };
  typeCollection[`${modelName}[]`] = new _graphql.GraphQLList(obj);
  return obj;
}

function createForeignKeyResolver(name, primaryKeyAttribute) {
  return function resolve(instance, args, context, info) {
    if (instance[primaryKeyAttribute]) {
      return (0, _node.toGlobalId)(name, instance[primaryKeyAttribute]);
    }

    return instance[primaryKeyAttribute];
  };
}
//# sourceMappingURL=create.js.map
