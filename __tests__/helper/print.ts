import {createInstance} from "./index";
import {createSchema} from "../../src/graphql/index";
import {printSchema} from "graphql";
(async() => {
  const instance = await createInstance();
  const schema = await createSchema(instance);
  console.log(printSchema(schema));
})();
