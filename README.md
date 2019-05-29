# gqlize

A relational databinder for generating graphql schemas to connect and work with multi data sources, used to be called [sql2gql](https://github.com/VostroNet/sql2gql/tree/v3)

## Install

```
yarn add @vostro/gqlize @vostro/gqlize-adapter-sequelize @vostro/graphql-types graphql-sequelize
```

## License

This repository generally is covered by GPL-3.0 unless specified

## Features

- Relational GraphQL Schema generator
- Supports Query and Mutations
- Fine grained permission control on which fields, models that you can query, mutate (Create, Update, Delete) directly via graphql
- multi data source compatible,
- Planned: cross adapter relationships e.g. `Sequelize[postgres]:Task:items[hasMany]->Sequelize[sqlite]:Item`

## Caveats

### Problem

Until [Proposal #252](https://github.com/graphql/graphql-spec/issues/252) is introduced, the schema generated is incompatible for mutations as subfields get executed asyncronously, only top level items get executed syncronously.

### Solution

We keep up to date a copy of graphql that will execute all mutations syncronously, this is non breaking change, it will work with any graphql library. The only issue is the way graphql insists that only one copy must exist in the entire node_modules folder.

*Requires yarn as your package manager*

```
yarn add graphql@npm:@vostro/graphql
```
add the following to your package.json, clear out your node_modules and run `yarn` again, this will ensure that this is the only copy of graphql to exist
```
  "resolutions": {
    "graphql": "npm:@vostro/graphql",
  }
```

## Adapters

- Sequelize - https://github.com/VostroNet/gqlize-adapter-sequelize

## TODO

- Use TravisCI for deployments

Documentation
- Install/Setup
- Model Definitions
- Adapter API
- Example Project
- Everything 

Functional
- validate submitted definitions via JSON Schema v7
- reimplement subscriptions
- before, after event hooks
- Implement cross adapter relationships

Unit Tests
- test add/remove from relationships
- test where operators
- test multiple enums
- test paging
- More Unit tests

Adapters
- add elasticsearch adapter
- add http graphql relay adapter

## Contributers

- Mick Hansen (Not a direct contributor, but I used alot of his code from graphql-sequelize as a reference and blatantly copied some)
- Lousie Apostol
- Matthew Mckenzie

## Example Query

```
query {
  models { 
    Task { 
      edges { 
        node { 
          id, 
          name, 
          items { 
            edges { 
              node { 
                id 
              } 
            } 
          } 
        } 
      } 
    } 
  }
}
```

## Example Mutation
```
mutation {
  models {
    Task(update: {
      where: {
        name: "start" 
      },
      input: {
        items: {
          remove: {
            name: {
              in: ["item000002", "item000003"]
            }
          }
        }
      }
    }) {
      id
      items {
        edges {
          node {
            id
            name
          }
        }
      }
    }
  }
}
```