import { CommandsRegistry, handlerLogin, runCommand } from "./command";
import { readConfig, setUser } from "./config";

function main() {
  // console.log("Hello, world!\n");
  // setUser('Mahmoud')
  // const cfg = readConfig()
  // console.log(cfg);
  const cmdRegistrey: CommandsRegistry = {}
  cmdRegistrey['login'] = handlerLogin

  const args = process.argv.slice(2);
  if(args.length === 0){
    throw new Error("There isn't at least one argument!")
    process.exit(1)
  }
    
  const cmd = args[0]
  const cmdArgs = args.slice(1)
  runCommand(cmdRegistrey, cmd, ...cmdArgs)

}

main();