import fs from 'fs';
import mPath from 'path';
import dotenv from 'dotenv';
import { ModuleInfo } from './module.downloader';
dotenv.config();
const env = process.env as any;

export interface LoaderFile {
    'load-env-from': string,
    'export-to': string,
    modules: ModuleInfo[]
}
function envChange(str: string) {
    if (str.startsWith('env.')) {
        str = str.substring(4);
        if (env[str]) return env[str];
        throw new Error(`No ${str} in .env`);
    }
    while (str.includes('{env.')) {
        let ee = str.split("{env.")[1]?.split('}')[0];
        if (!ee) throw new Error("Invalid parse")
        if (!env[ee]) throw new Error(`No ${ee} in .env`);
        if (!str.includes('{env.'+ee+'}')) {
            throw new Error("Invalid parse")
        }
        str = str.replace('{env.'+ee+'}', env[ee]);
    }
    return str;
}

function _parseJsonFile(path: string): LoaderFile {
    let json = JSON.parse(fs.readFileSync(path).toString());
    if ('moduleDownloaderConfig' in json) {
        json = json.moduleDownloaderConfig;
    }
    return json;
}

export function parseFile(path: string) {
    path = mPath.resolve(process.cwd(), path);
    const file = _parseJsonFile(path);
    
    file['load-env-from'] = envChange(file['load-env-from']);
    dotenv.config({ path: file['load-env-from'] });

    file.modules.forEach(mod => {
        mod.link = envChange(mod.link);
        mod.token = envChange(mod.token);
        if (!mod.header) mod.header = 'Authorization'; 
    });
    return file;
}
