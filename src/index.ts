import db from "./manager";
import {createSchema as create} from "./graphql/index";
export const Database = db;
export const createSchema = create;
