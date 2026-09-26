import { and, eq } from "drizzle-orm";
import { db } from "..";
import { feed_follows, feeds, users } from "../schema";


export async function createFeedFollow(feed_id:any, user_id:any) {
    const [result] = await db.insert(feed_follows)
        .values({ feed_id: feed_id, user_id:user_id }).returning();
    
    if (!result) throw new Error("Insert failed");
    if(result)
        return getFeedFollowInfo(feed_id, user_id);
}


export async function getFeedFollowsForUser(user_id:any) {
  try{
    const result = await db
    .select({
      feedName: feeds.name,
    }).from(feed_follows)
    .innerJoin(feeds, eq(feed_follows.feed_id, feeds.id))
    .innerJoin(users, eq(feed_follows.user_id, users.id))
    .where(eq(feed_follows.user_id, user_id));
    return result

  } catch(e){
    throw Error("FeedFollow already exists!")
  }
 
}


export async function deleteFeedFollow(feed_id:any, user_id:any) {
    const [result] = await db.delete(feed_follows)
        .where(and(eq(feed_follows.feed_id, feed_id), eq(feed_follows.user_id, user_id)))
        .returning();
    
    if (!result) throw new Error("Follow not found");
    return result;
}


export async function getFeedFollowInfo(feed_id:any, user_id:any) {
  const [result] = await db
  .select({
      feed_id: feed_follows.feed_id,
      user_id: feed_follows.user_id,
      userName: users.name,
      feedName: feeds.name,
      id: feed_follows.id,
      createdAt: feed_follows.createdAt,
      updatedAt: feed_follows.updatedAt,
    })
    .from(feed_follows)
    .innerJoin(feeds, eq(feed_follows.feed_id, feeds.id))
    .innerJoin(users, eq(feed_follows.user_id, users.id))
    .where(and(eq(feed_follows.feed_id, feed_id), eq(feed_follows.user_id, user_id)));
  return result;
}


// export async function getUserById(id: any) {
//   const [result] = await db.select().from(users).where(eq(users.id, id));
//   return result;
// }


// export async function clearUsers() {
//   const [result] = await db.delete(users).returning();
//   return result;
// }


// export async function getUsers() {
//   const result = await db.select({name: users.name}).from(users);
//   return result;
// }