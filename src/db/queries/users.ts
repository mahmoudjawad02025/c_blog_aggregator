import { eq } from "drizzle-orm";
import { db } from "..";
import { users } from "../schema";


export async function createUser(name: string) {
  try{
    const [result] = await db.insert(users).values({ name: name }).returning();
    return result;
  } catch(e){
    throw Error("User already exists!")
  }
 
}


export async function getUserByName(name: string) {
  const [result] = await db.select().from(users).where(eq(users.name, name));
  return result;
}


export async function clearUsers() {
  const [result] = await db.delete(users).returning();
  return result;
}


export async function getUsers() {
  const result = await db.select({name: users.name}).from(users);
  return result;
}