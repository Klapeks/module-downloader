import mPath from "path";
import fs from 'fs';
import archiver from "archiver";
import unzipper from '7zip-min';

interface ZipOutput {
    original: string,
    file: string,
    archive: archiver.Archiver
}
interface UnzipOutput {
    original: string,
    folder: string,
}

const archiveUtils = {
    foundNewName(file: string, suffix?: string) {
        if (!suffix) suffix = '';
        if (fs.existsSync(file+suffix)) {
            let tryEx = 1;
            while (fs.existsSync(file+' ('+tryEx+')'+suffix)) {
                tryEx++;
                if (tryEx >= 1000) throw "Iterated more then 1000 files"
            }
            file += ' ('+tryEx+")";
        }
        return file + suffix;
    },
    zip(folder: string, outputPath: string = ''): Promise<ZipOutput> {
        if (folder.endsWith('/')) {
            folder = folder.substring(0, folder.length-1);
        }
        if (outputPath && fs.existsSync(outputPath)) {
            fs.writeFileSync(outputPath, '');
        }
        if (!outputPath) {
            outputPath = archiveUtils.foundNewName(folder, '.zip');
        }
        if (!outputPath.endsWith('.zip')) {
            outputPath = archiveUtils.foundNewName(
                mPath.join(outputPath, folder), '.zip');
        }

        console.log('compressing to...', outputPath);
        return new Promise<ZipOutput>((resolve, reject) => {
            const output = fs.createWriteStream(outputPath);
            const archive = archiver('zip', {zlib: {level: 5}});
    
            output.on('close', function () {
                console.log(archive.pointer() + ' total bytes');
                console.log('archiver has been finalized and the output file descriptor has closed.');
                resolve({ archive, original: folder, file: outputPath });
            });
            archive.on('error', (err) => reject(err));
            archive.pipe(output);
            archive.directory(folder, false);
            archive.finalize();
        })
    },
    supportZipFormats: [
        '7z', 'lzma', 'cab', 'zip', 'gzip', 'bzip2', 'Z', 'tar'
    ],
    async unzip(file: string, outputPath = ''): Promise<UnzipOutput> {
        const extension = file.substring(file.lastIndexOf('.')+1);
        if (!outputPath) {
            outputPath = file.substring(0, file.lastIndexOf('.'));
            outputPath = archiveUtils.foundNewName(outputPath);
        }
        console.log('unziping:', extension, 'output folder:', outputPath);
        if (!this.supportZipFormats.includes(extension)) {
            throw "Extension not supported";
        }
        return new Promise<UnzipOutput>((resolve, reject) => {
            unzipper.unpack(file, outputPath, (err) => {
                if (err) return reject(err);
                resolve({ folder: outputPath, original: file });     
            });
        });
    }
}
export default archiveUtils;