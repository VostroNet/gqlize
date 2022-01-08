import {createInstance} from "./helper";
import {createSchema} from "../src/graphql/index";
import { GraphQLObjectType } from 'graphql';
describe("comments", () => {
  it("classMethod", async() => {
    const instance = await createInstance();
    const schema = await createSchema(instance);
    const itemClassMethodsType = schema.getType("ItemMutationsClassMethods") as GraphQLObjectType;
    if(itemClassMethodsType) {
      expect(itemClassMethodsType.getFields().reverseName.description).toEqual("reverseName comment");
    } else {
      expect(true).toBe(false);
    }
  });


  it("instanceMethod", async() => {
    const instance = await createInstance();
    const schema = await createSchema(instance);
    const itemType = schema.getType("Item") as GraphQLObjectType;
    if(itemType) {
      expect(itemType.getFields().testInstanceMethod.description).toEqual("testInstanceMethod comment");
    } else {
      expect(true).toBe(false);
    }
  });

  it("field", async() => {
    const instance = await createInstance();
    const schema = await createSchema(instance);
    const itemType = schema.getType("Item") as GraphQLObjectType;
    if(itemType) {
      expect(itemType.getFields().name.description).toEqual("name comment");
    } else {
      expect(true).toBe(false);
    }

  });
  it("relationship - singular", async() => {
    const instance = await createInstance();
    const schema = await createSchema(instance);
    const itemType = schema.getType("Item") as GraphQLObjectType;
    if(itemType) {
      expect(itemType.getFields().hasOne.description).toEqual("hasOne comment");
    } else {
      expect(true).toBe(false);
    }
  });
  it("relationship - list", async() => {
    const instance = await createInstance();
    const schema = await createSchema(instance);
    const itemType = schema.getType("Item") as GraphQLObjectType;
    if(itemType) {
      expect(itemType.getFields().children.description).toEqual("children comment");
    } else {
      expect(true).toBe(false);
    }
  });
  it("model", async() => {
    const instance = await createInstance();
    const schema = await createSchema(instance);
    const itemType = schema.getType("Item") as GraphQLObjectType;
    if(itemType) {
      expect(itemType.description).toEqual("item comment");
    } else {
      expect(true).toBe(false);
    }
  });
});
