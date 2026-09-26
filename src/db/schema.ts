import { integer } from "drizzle-orm/gel-core";
import { pgTable, timestamp, uuid, text, unique } from "drizzle-orm/pg-core";


export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  name: text("name").notNull().unique(),
});
export type User = typeof users.$inferSelect;


export const feeds = pgTable("feeds", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  name: text("name").notNull(),
  url: text("url").unique().notNull(),
  user_id: uuid("user_id").notNull().references(()=> users.id, {onDelete: "cascade"})
});
export type Feed = typeof feeds.$inferSelect;


export const feed_follows = pgTable("feed_follows", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  feed_id: uuid("feed_id").notNull().references(()=> feeds.id, {onDelete: "cascade"}),
  user_id: uuid("user_id").notNull().references(()=> users.id, {onDelete: "cascade"})
}, (table) => [
  unique("feed_follows_feed_user_unique").on(table.feed_id, table.user_id),
]);
export type Feed_Follows = typeof feeds.$inferSelect;