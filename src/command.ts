import { readConfig, setUser } from "./config";
import { clearUsers, createUser, getUserByName, getUsers } from "./db/queries/users";


// - - - - - - - - - - - - - - - - - - - - - - - - - types


export type CommandHandler = 
    (cmdName: string, ...args: string[]) => void;

export type CommandsRegistry = Record<string, CommandHandler>;


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


// - - - - - - - - - - - - - - - - - - - - - - - - - handlers


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
        throw new Error("the login handler expects a single argument, the username")
    await createUser(args[0])
    setUser(args[0])
    const user = await getUserByName(args[0])
    console.log("User has been created!",user)
}


export async function handlerReset(cmdName: string, ...args: string[]){
    // if(args.length === 0)
    //     throw new Error("the Reset handler expects a single argument")
    const res = await clearUsers()
    if(res)
        console.log("Users have been cleared!")
    else
        console.log("Something happened, retry later!")
}


export async function handlerListUsers(cmdName: string, ...args: string[]){
    // if(args.length === 0)
    //     throw new Error("the Reset handler expects a single argument")
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
