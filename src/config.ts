import fs from "fs";
import os from "os";
import path from "path";


// - - - - - - - - - - - - - - - - - - - - - - - - - types


export type Config = {
  dbUrl: string;
  currentUserName?: string;
};

type RawConfig = {
  db_url?: string;
  current_user_name?: string;
};

// - - - - - - - - - - - - - - - - - - - - - - - - - core


export function setUser(username: string){
    if(username.length === 0)
        return

    const config = readConfig()
    config.currentUserName = username
    writeConfig(config)
}

export function readConfig(): Config{
    const file = getConfigFilePath()
    const result = fs.readFileSync(file, 'utf-8')
    const raw = JSON.parse(result)
    return validateConfig(raw) 
}

function writeConfig(config: Config): void{
    const raw: RawConfig = {
        db_url: config.dbUrl,
        current_user_name: config.currentUserName,
    };
    const configString = JSON.stringify(raw, null, 2);
    fs.writeFileSync(getConfigFilePath(), configString, "utf-8")
}


// - - - - - - - - - - - - - - - - - - - - - - - - - helpers


function getConfigFilePath(): string{
    return path.join(os.homedir(), '.gatorconfig.json')
}


function validateConfig(raw: any): Config{
    if(typeof raw !== 'object' || raw === null)
        throw new Error("Invalid config format");

    if(typeof raw.db_url !== 'string')
        throw new Error("Missing or invalid dbUrl in config");

    return{
        dbUrl: raw.db_url,
        currentUserName: raw.current_user_name
    }
}