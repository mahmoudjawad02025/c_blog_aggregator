import { title } from "node:process";
import { readConfig, setUser } from "./config";
import { parseDuration } from "./core/helpers";
import { createFeedFollow, deleteFeedFollow, getFeedFollowsForUser } from "./db/queries/feed_follows";
import { addFeed, getFeedByUrl, getFeeds, getNextFeedToFetch, markFeedFetched } from "./db/queries/feeds";
import { createPost, getPostsForUser } from "./db/queries/posts";
import { clearUsers, createUser, getUserById, getUserByName, getUsers } from "./db/queries/users";
import { Feed, User } from "./db/schema";
import { fetchFeed } from "./rss";


// - - - - - - - - - - - - - - - - - - - - - - - - - types
 

export type CommandHandler = 
    (cmdName: string, ...args: string[]) => void;

export type CommandsRegistry = Record<string, CommandHandler>;

export type UserCommandHandler = (
  cmdName: string,
  user: User,
  ...args: string[]
) => Promise<void>;


// - - - - - - - - - - - - - - - - - - - - - - - - - core


export function registerCommand(registry: CommandsRegistry, cmdName: string, handler: CommandHandler){
    if(cmdName === null || handler === undefined)
        return
    registry[cmdName] = handler
}


export async function runCommand(registry: CommandsRegistry, cmdName: string, ...args: string[]){
    const handler = registry[cmdName]
    if(cmdName === null || handler === undefined)
        throw new Error(`Command '${cmdName}' not found`);
    await handler(cmdName, ...args)
}


// - - - - - - - - - - - - - - - - - - - - - - - - - handlers_users


export async function handlerLogin(cmdName: string, ...args: string[]){
    if(args.length === 0)
        throw new Error("the login handler expects a single argument, the username")
    const user = await getUserByName(args[0]);
    if (!user) {
        throw new Error("User does not exist!");
    }
    
    await setUser(args[0])
    console.log("User has been set!")
}


export async function handlerRegister(cmdName: string, ...args: string[]){
    if(args.length === 0)
        throw new Error("the register handler expects a single argument, the username")
    await createUser(args[0])
    setUser(args[0])
    const user = await getUserByName(args[0])
    console.log("User has been created!",user)
}


export async function handlerReset(cmdName: string, ...args: string[]){
    const res = await clearUsers()
    if(res)
        console.log("Users have been cleared!")
    else
        console.log("Something happened, retry later!")
}


export async function handlerListUsers(cmdName: string, ...args: string[]){
    const res = await getUsers()
    const config = readConfig()
        
    if(res)
        for(let x of res){
            if(x.name === config.currentUserName)
                console.log(x.name+' (current)')
            else
                console.log(x.name)
        }
    else
        console.log("Something happened, retry later!")
}


// - - - - - - - - - - - - - - - - - - - - - - - - - handlers_rss


export async function handlerAgg(cmdName: string, ...args: string[]){
    if(args.length !== 1)
        throw new Error("Expects 1 argument!");

    const ms = parseDuration(args[0]);
    console.log(`Collecting feeds every ${args[0]}`);
    scrapeFeeds().catch((e) => console.error(e));

    const interval = setInterval(() => {
        scrapeFeeds().catch((e) => console.error(e));
    }, ms);

    await new Promise<void>((resolve) => {
        process.on("SIGINT", () => {
            console.log("Shutting down feed aggregator...");
            clearInterval(interval);
            resolve();
        });
    });
}


export async function handlerAddFeed(cmdName: string, user:User, ...args: string[]){
    if(args.length !== 2)
        throw new Error("addfeed expects two arguments: name and url");
    
    const feed = await addFeed(args[0], args[1], user.id);
    if (!feed) throw new Error("Feed insert failed");

    const follow = await createFeedFollow(feed.id, user.id);
    if (!follow) throw new Error("Follow insert failed");

    helperPrintFeed(follow.feedName, follow.userName);
}


export async function handlerListFeeds(cmdName: string, ...args: string[]){
    // if(args.length === 0)
    //     throw new Error("the Reset handler expects a single argument")
    const res = await getFeeds()
        
    if(res)
        for(let feed of res){
            const user = await getUserById(feed.user_id)

            console.log(feed.name, feed.url, user.name)
        }
    else
        console.log("Something happened, retry later!")
}



export async function handlerCreateFeedFollow(cmdName: string, user:User, ...args: string[]){
    if(args.length === 0)
        throw new Error("The handler expects a single argument!")

    // feed_id
    const feed = await getFeedByUrl(args[0]);
    const feed_id = feed.id
    const user_id = user.id

    // call
    if(args.length === 0)
        throw new Error("the handler expects a single argument!")
    const res = await createFeedFollow(feed_id, user_id)

    console.log("Done!", res?.feedName, res?.userName)
}


export async function handlerListFeedFollows(cmdName: string, user:User, ...args: string[]){
    const user_id = user.id
    const res = await getFeedFollowsForUser(user_id)
        
    if(res)
        for(let x of res){
            console.log(x.feedName)
        }
    else
        console.log("Something happened, retry later!")
}


export async function handlerDeleteFeedFollow(cmdName: string, user:User, ...args: string[]){
    if(args.length === 0)
        throw new Error("The handler expects a single argument!")

    // feed_id
    const feed = await getFeedByUrl(args[0]);
    const feed_id = feed.id
    const user_id = user.id

    // call
    if(args.length === 0)
        throw new Error("the handler expects a single argument!")
    const res = await deleteFeedFollow(feed_id, user_id)

    console.log(`Unfollowed ${feed.name}`);
}


export async function scrapeFeeds(){

    const nextFeed = await getNextFeedToFetch()
    const res = await fetchFeed(nextFeed.url)
    await markFeedFetched(nextFeed.id)
        
    if(res){
        const items = res.channel.item ?? [];
        for(let item of items){
            await createPost(
                item.title,
                item.link,
                nextFeed.id,
                item.pubDate ? new Date(item.pubDate) : null,
                item.description ?? null
            )
        }
    }
    else
        console.log("Something happened, retry later!")
}


// - - - - - - - - - - - - - - - - - - - - - - - - - posts
export async function handlerGetLatestUserPosts(cmdName: string, user:User, ...args: string[]){
    const user_id = user.id
    const limit = args[0] ? parseInt(args[0]) : 2;
    const res = await getPostsForUser(user_id, limit)
        
    if(res)
        for(let x of res){
            console.log(x)
        }
    else
        console.log("Something happened, retry later!")
}


// - - - - - - - - - - - - - - - - - - - - - - - - - helpers


export async function helperPrintFeed(feed: string, user: string){
    if(!feed || !user)
        throw new Error("failed to print, feed or user equal null")
    
    console.log(feed, user)
}