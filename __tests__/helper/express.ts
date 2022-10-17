import express from "express";
import { createServer } from '@graphql-yoga/node'
import {createInstance} from "./index";
import {createSchema} from "../../src/graphql/index";

const PORT = 3005;
const app = express();
(async() => {
 
  const app = express()
  const instance = await createInstance();
  const schema = await createSchema(instance);

  const graphQLServer = createServer({
    schema,
  })
  app.use('/graphql', graphQLServer)
 
  app.listen(PORT);
})().then(() => {
  console.log("success", PORT);
}, (err) => {
  console.log("ERR", err);
});
