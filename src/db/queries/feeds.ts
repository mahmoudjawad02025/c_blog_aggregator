import { eq } from "drizzle-orm";
import { db } from "..";
import { feeds, users } from "../schema";


export async function addFeed(name: string, url: string, user_id: string, ) {
  try{
    const [result] = await db.insert(feeds).values({ name: name, url:url, user_id:user_id,}).returning();
    return result;
  } catch(e){
    throw Error("Feed already exists!")
  }
 
} 


// export async function getUserByName(name: string) {
//   const [result] = await db.select().from(users).where(eq(users.name, name));
//   return result;
// }


// export async function clearUsers() {
//   const [result] = await db.delete(users).returning();
//   return result;
// }


export async function getFeeds() {
  const result = await db.select().from(feeds);
  return result;
}