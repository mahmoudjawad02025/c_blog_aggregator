import { CommandHandler, UserCommandHandler } from "src/command";
import { readConfig } from "src/config";
import { getUserByName } from "src/db/queries/users";


export function middlewareLoggedIn (handler: UserCommandHandler): CommandHandler{
    return async (cmdName: string, ...args: string[]) => {
        const config = readConfig()
        if (!config.currentUserName) {
            throw new Error("User does not exist!");
        }
        const user = await getUserByName(config.currentUserName);
        if (!user) {
            throw new Error("User not found");
        }
        await handler(cmdName, user, ...args)
    }
};