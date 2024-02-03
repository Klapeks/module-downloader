import fs from 'fs';
import mPath from 'path';
import { parseFile } from './parser';
import axios from 'axios';
import archiveUtils from './archive.utils';
import { IncomingMessage } from 'http';
import { spawn } from 'child_process';

(process.env as any)['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;

export interface ModuleInfo {
    module: string,
    link: string,
    token: string,
    header: string,
    replace?: string
}

async function streamToData(stream: IncomingMessage) {
    const chunks = [] as Buffer[];
    return new Promise((resolve, reject) => {
        stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        stream.on('error', (err) => reject(err));
        stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    })
}


export async function downloadModule(module: ModuleInfo, outputFolder: string) {
    const output = mPath.join(process.cwd(), outputFolder, module.module);
    if (fs.existsSync(output)) {
        console.log("Module already downloaded:", output);
        return;
    }
    try {
        if (fs.lstatSync(output)?.isSymbolicLink()) {
            fs.rmSync(output);
        }
    } catch(err) {}

    fs.mkdirSync(output, { recursive: true });
    console.log("Loading module...", module);
    try {
        const res = await axios({
            method: "get", 
            url: module.link,
            responseType: "stream",
            
            headers: {
                [module.header]: module.token
            }
        });

        const zipFile = mPath.join(output, '.tmp.mod.zip');
        await new Promise<void>((resolve, reject) => {
            const stream = fs.createWriteStream(zipFile);
            stream.once('error', (err) => reject(err));
            stream.once('close', () => resolve());
            res.data.pipe(stream);
        });
        console.log("File downloaded:", output);

        console.log("Unzipping...");
        const uzres = await archiveUtils.unzip(zipFile, output);

        console.log("Unzipped:", uzres.folder);
        fs.rmSync(zipFile, { force: true });
        if (module.replace) {
            console.log("Module", module.replace, 'will be replaced by', module.module);
            const replace = mPath.join(process.cwd(), outputFolder, module.replace);
            fs.rmSync(replace, { force: true, recursive: true });
            fs.renameSync(output, replace);

            const _replaceAll = (filePath: string, from: string, to: string) => {
                filePath = mPath.join(replace, filePath);
                if (!fs.existsSync(filePath)) return;
                let data = fs.readFileSync(filePath).toString();
                while (data.includes(from)) data = data.replace(from, to);
                fs.writeFileSync(filePath, data);
            }
            _replaceAll('package.json', module.module, module.replace);
            _replaceAll('package-lock.json', module.module, module.replace);
            console.log("Module", module.replace, 'replaced by', module.module);
        }
        // await new Promise<void>((resolve, reject) => {
        //     // console.log("NOfbiuowjpogk", process.cwd());
        //     // console.log(JSON.parse(fs.readFileSync(mPath.join(uzres.folder,'package.json')).toString()))
        //     // console.log("spawning npm::", ['install', '--prefix', process.cwd(), uzres.folder]);
        //     // const p = spawn("npm", ['install', '--prefix', process.cwd(), uzres.folder], {
        //     const p = spawn("npm", ['install'], {
        //         cwd: uzres.folder
        //     });
        //     console.log("spawning process::", p.pid);
        //     p.stdout.setEncoding('utf8');
        //     p.stdout.on('data', (data) => {
        //         console.log('[npm install]', data);
        //     });
        //     p.stderr.setEncoding('utf8');
        //     p.stderr.on('data', (data) => {
        //         console.error('[npm i err]', data);
        //     });
        //     p.on('error', (err) => reject(err));
        //     p.on('close', () => resolve());
        //     p.on('exit', () => resolve());
        // });
        // fs.rmSync(mPath.join(uzres.folder, 'node_modules'), {
        //     force: true, recursive: true 
        // });
    }
    catch (err: any) {
        try {
            fs.rmSync(output, { recursive: true, force: true });
        } catch(err2:any) {}

        if (err.response) {
            let data = err.response.data;
            if ('pipe' in data) data = await streamToData(data);
            data = data.error || data.message || data || err.response.statusText;
            if (typeof data === 'object') data = JSON.stringify(data);
            throw new Error(data || "axios error");
        }
        throw err;
    }
    // fs.rmSync(output, )
}

export async function downloadAll(filePath: string) {
    const file = parseFile(filePath);
    for (let module of file.modules) {
        await downloadModule(module, file['export-to']);
    }
}