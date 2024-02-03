import fs from 'fs';
import mPath from 'path';
import { parseFile } from './parser';
import axios from 'axios';
import archiveUtils from './archive.utils';
import { IncomingMessage } from 'http';

(process.env as any)['NODE_TLS_REJECT_UNAUTHORIZED'] = 0;

export interface ModuleInfo {
    module: string,
    link: string,
    token: string,
    header: string   
}

async function streamToData(stream: IncomingMessage) {
    const chunks = [] as Buffer[];
    return new Promise((resolve, reject) => {
        stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        stream.on('error', (err) => reject(err));
        stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    })
}

export async function downloadModule(module: ModuleInfo, output: string) {
    output = mPath.join(process.cwd(), output, module.module);
    if (fs.existsSync(output)) {
        console.log("Module already downloaded:", output);
        return;
    }
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