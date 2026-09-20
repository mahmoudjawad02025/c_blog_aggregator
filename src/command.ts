import { setUser } from "./config";


// - - - - - - - - - - - - - - - - - - - - - - - - - types


export type CommandHandler = 
    (cmdName: string, ...args: string[]) => void;

export type CommandsRegistry = Record<string, CommandHandler>;


// - - - - - - - - - - - - - - - - - - - - - - - - - core


export function handlerLogin(cmdName: string, ...args: string[]){
    if(args.length === 0)
        throw new Error("the login handler expects a single argument, the username")
    setUser(args[0])
    console.log("User has been set!")
}


export function registerCommand(registry: CommandsRegistry, cmdName: string, handler: CommandHandler){
    if(cmdName === null || handler === undefined)
        return
    registry[cmdName] = handler
}


export function runCommand(registry: CommandsRegistry, cmdName: string, ...args: string[]){
    const handler = registry[cmdName]
    if(cmdName === null || handler === undefined)
        throw new Error(`Command '${cmdName}' not found`);
    handler(cmdName, ...args)
}