/*

The MIT License (MIT)

Copyright (c) 2015 Mick Hansen

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

// https://github.com/mickhansen/graphql-sequelize/blob/master/src/relay.js
import {
  fromGlobalId,
} from "graphql-relay";


export default function idFetcher(database: { models: { [x: string]: { findByPk: (arg0: string) => any; }; }; }, nodeTypeMapper: { item: (arg0: string) => any; }) {
  return async(globalId: string, context: any, info: { schema: { getType: (arg0: any) => any; }; }) => {
    if (globalId === null || globalId === undefined) {
      return null;
    }
    const {type, id} = fromGlobalId(globalId);

    const nodeType = nodeTypeMapper.item(type);
    if (nodeType && typeof nodeType.resolve === "function") {
      const res = await Promise.resolve(nodeType.resolve(globalId, context, info));
      if (res) {
        res.__graphqlType__ = type; //eslint-disable-line
      }
      return res;
    }

    const model = Object.keys(database.models).find(model => model === type);
    if (model) {
      return database.models[model].findByPk(id);
      //TODO: probably should abstract this instead of accessing the models directly
    }

    if (nodeType) {
      return typeof nodeType.type === "string" ? info.schema.getType(nodeType.type) : nodeType.type;
    }

    return null;
  };
}
