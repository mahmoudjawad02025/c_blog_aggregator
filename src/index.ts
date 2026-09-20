import { readConfig, setUser } from "./config";

function main() {
  // console.log("Hello, world!\n");
  setUser('Mahmoud')
  const cfg = readConfig()
  console.log(cfg);
}

main();