import { desc, eq } from "drizzle-orm";
import { db } from "..";
import { feed_follows, feeds, posts, users } from "../schema";


export async function createPost(title: string, url: string, feed_id: any, 
  publishedAt?: Date, description?: string) {
  const [result] = await db
    .insert(posts)
    .values({ title: title, url: url, publishedAt: publishedAt, 
      description: description, feed_id: feed_id})
    .onConflictDoNothing({ target: posts.url })
    .returning();
    
  if(!result)
    throw Error("Something went wrong!")
  return result;
 
}


export async function getPostsForUser(user_id: any, limit: number) {
  const result = await db
  .select({
      id: posts.id,
      title: posts.title,
      url: posts.url,
      description: posts.description,
      publishedAt: posts.publishedAt,
      feedName: feeds.name,
    })
  .from(posts)
  .innerJoin(feeds, eq(feeds.id, posts.feed_id))
  .innerJoin(feed_follows, eq(feeds.id, feed_follows.feed_id))
  .where(eq(feed_follows.user_id, user_id))
  .orderBy(desc(posts.publishedAt))
  .limit(limit);

  return result;
}


// export async function getUserByName(name: string) {
//   const [result] = await db.select().from(users).where(eq(users.name, name));
//   return result;
// }


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