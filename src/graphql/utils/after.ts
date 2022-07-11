import Events from "../../events";

export async function processAfter(node: any, args: any, context: any, info: any, definition: any, e: Events) {
  let n = node;
  if (definition.after) {
    n = await definition.after({
      result: node, args, context, info, modelDefinition: definition,
      type: Events.QUERY || e,
    })
  }
  if (n.override) {
    n = n.override;
  }
  return n;
}