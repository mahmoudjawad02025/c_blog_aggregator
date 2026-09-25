import { CommandsRegistry, handlerAddFeed, handlerAgg, handlerListFeeds, handlerListUsers, handlerLogin, handlerRegister, handlerReset, runCommand } from "./command";
import { readConfig, setUser } from "./config";


import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");

async function main() {
  const cmdRegistrey: CommandsRegistry = {}
  cmdRegistrey['login'] = handlerLogin
  cmdRegistrey['register'] = handlerRegister
  cmdRegistrey['reset'] = handlerReset
  cmdRegistrey['users'] = handlerListUsers
  cmdRegistrey['agg'] = handlerAgg
  cmdRegistrey['addfeed'] = handlerAddFeed
  cmdRegistrey['feeds'] = handlerListFeeds


  const args = process.argv.slice(2);
  if(args.length === 0){
    throw new Error("There isn't at least one argument!")
    process.exit(1)
  }
    

  const cmd = args[0]
  const cmdArgs = args.slice(1)
  await runCommand(cmdRegistrey, cmd, ...cmdArgs)
  process.exit(0);
}

main();