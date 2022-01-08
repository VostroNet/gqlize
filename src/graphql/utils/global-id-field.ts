import {GraphQLID, GraphQLNonNull} from "graphql";

import {
  toGlobalId,
} from "graphql-relay";

export default function globalIdField(typeName: any, idFetcher: (arg0: any, arg1: any, arg2: any) => any, isNullable: any) {
  let type;
  if (!isNullable) {
    type = new GraphQLNonNull(GraphQLID);
  } else {
    type = GraphQLID;
  }
  return {
    description: "The ID of an object",
    type,
    resolve: (obj: { id: any; }, args: any, context: any, info: { parentType: { name: any; }; }) => {
      const id = idFetcher ? idFetcher(obj, context, info) : obj.id;
      if (!id && id !== 0 && isNullable) {
        return undefined;
      } else {
        return toGlobalId(
          typeName || info.parentType.name,
          id
        );
      }
    },
  };
}
