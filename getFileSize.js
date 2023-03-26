const fs = require('fs');
const VERSION_NO = 'v1';

function readJsonFromFile(fileName) {
    return JSON.parse(fs.readFileSync(fileName))
}

/**
 * Format bytes as human-readable text.
 * 
 * @param bytes Number of bytes.
 * @param si True to use metric (SI) units, aka powers of 1000. False to use 
 *           binary (IEC), aka powers of 1024.
 * @param dp Number of decimal places to display.
 * 
 * @return Formatted string.
 */
function humanFileSize(bytes, si = false, dp = 1) {
    const thresh = si ? 1000 : 1024;

    if (Math.abs(bytes) < thresh) {
        return bytes + ' B';
    }

    const units = si
        ? ['kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
        : ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
    let u = -1;
    const r = 10 ** dp;

    do {
        bytes /= thresh;
        ++u;
    } while (Math.round(Math.abs(bytes) * r) / r >= thresh && u < units.length - 1);


    return bytes.toFixed(dp) + ' ' + units[u];
}

async function main() {
    let data = [];
    try {
        data = readJsonFromFile(`./${VERSION_NO}/summary.json`);
        data = data.book;
    } catch (e) {
        console.log(`file for summary.json not exist yet`);
    }

    let csv = '';
    for (let i = 0; i < data.length; i++) {
        const book = data[i];
        let bookName = book.name;
        let authorName = book.author;
        const { size } = fs.statSync(`./${VERSION_NO}/author/${authorName}/${bookName}.epub`);
        data[i]["size"] = humanFileSize(size, true);
        data[i]["size_in_bytes"] = size;
        csv += `"${bookName}",${data[i]["size"]},${data[i]["size_in_bytes"]}\n`;
    }

    fs.appendFileSync(`./${VERSION_NO}/filesize.csv`, csv);
    console.log('done');
}

main();