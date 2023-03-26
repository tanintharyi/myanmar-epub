const axios = require('axios').default;
const fs = require('fs');
const https = require('https'); // or 'https' for https:// URLs

const SPREADSHEET_SECRETKEY = process.env.SPREADSHEET_SECRETKEY;
const GITHUB_CONTEXT_PAYLOAD = process.env.GITHUB_CONTEXT_PAYLOAD ? JSON.parse(process.env.GITHUB_CONTEXT_PAYLOAD) : '';
const BUILD_FOLDER = 'build';
const VERSION_NO = 'v1';

async function geSpreadsheetData(isAuthor = false) {
    let data = [];
    try {
        let sheetName = isAuthor ? 'Author' : 'Sheet1';
        const response = await axios.get(`https://sheets.googleapis.com/v4/spreadsheets/1bPsbxgOeHLZIVkJS5Zj59AKNSnZbOI22P8ENP7hhewk/values/${sheetName}?key=${SPREADSHEET_SECRETKEY}`);
        data = response.data;
        if (!data.values) return [];
        data = data.values;
    } catch (error) {
        console.error(error);
    }
    return data;
}

function readJsonFromFile(fileName) {
    return JSON.parse(fs.readFileSync(fileName))
}

function writeJsonToFile(jsonObj = {}, fileName = '') {
    // fileName မှာ / ပါခဲ့ရင် directory ကိုမရှိသေးရင် တည်ဆောက်ပေး
    // console.log(`writeJsonToFile`, fileName);
    if (fileName.indexOf('/') > -1) {
        let fileNameArr = fileName.split('/');
        fileNameArr.length = fileNameArr.length - 1;
        let dirName = `${BUILD_FOLDER}/${VERSION_NO}/`;
        if (!fs.existsSync(BUILD_FOLDER)) {
            fs.mkdirSync(BUILD_FOLDER);
        }
        if (!fs.existsSync(dirName)) {
            fs.mkdirSync(dirName);
        }
        fileNameArr.forEach((e) => {
            dirName += `${e}/`;
            if (!fs.existsSync(dirName)) {
                fs.mkdirSync(dirName);
            }
        });
    }

    if (Array.isArray(jsonObj)) {
        jsonObj = {
            items: jsonObj
        }
    }

    let jsonString = JSON.stringify(jsonObj, null, 4);
    fs.writeFileSync(`${BUILD_FOLDER}/${VERSION_NO}/${fileName}.json`, jsonString);
}

function getFormattedDate(date, isOnlyDigit = false) {
    if (!date) return '';
    let d = date;
    if (typeof date === "string") {
        d = new Date(date);
    }
    d = d.getFullYear() + "-" + ('0' + (d.getMonth() + 1)).slice(-2) + "-" + ('0' + d.getDate()).slice(-2);
    if (isOnlyDigit) {
        d = d.replace(/-/g, '');
    }
    // date ဟုတ်မဟုတ် သေချာအောင်ထပ်ပြန်စစ်ပေးပြီး မဟုတ်ရင် '' ကိုပဲ return ပြန်ပေးလိုက်မယ်
    if (!d.match(/^[0-9\-]+$/i)) {
        return '';
    }
    return d;
}

function convertArr2ObjArr(data) {
    if (!data.length) return [];
    let objArr = [];
    for (let i = 1; i < data.length; i++) {
        let obj = {};
        for (let ii = 0; ii < data[0].length; ii++) {
            let key = data[0][ii];
            let value = data[i][ii];
            obj[key] = value;
        }
        objArr.push(obj);
    }
    return objArr;
}

function downloadFile(fileUrl, fileName) {
    return new Promise((resolve, reject) => {
        console.log("downloadFile", fileUrl)
        if (!fileUrl) resolve("done!");
        fileName = `${BUILD_FOLDER}/${VERSION_NO}/${fileName}`;
        let fileNameArr = fileName.split("/");
        for (let i = 1; i < fileNameArr.length; i++) {
            let theDir = fileNameArr.slice(0, i).join('/')
            if (!fs.existsSync(theDir)) {
                fs.mkdirSync(theDir);
            }
        }
        const file = fs.createWriteStream(fileName);
        https.get(fileUrl, function (response) {
            response.pipe(file);

            // after download completed close filestream
            file.on("finish", () => {
                file.close();
                console.log("Download Completed");
                resolve("done!")
            });
        });
    });

}

function createSummary(data, dataAuthor) {
    let summaryObj = {};
    summaryObj["totalBook"] = data.length;
    summaryObj["totalAuthor"] = dataAuthor.length;

    let bookArr = [];
    data.map(book => bookArr.push({
        "name": book["name"],
        "author": book["author"],
        "isCoverImg": book["cover-url"] ? true : false,
        "category": book["category"],
        "description": book["description"],
        "is_new": book["is_new"],
    }));
    summaryObj["book"] = bookArr;

    let authorArr = [];
    dataAuthor.map(author => authorArr.push({
        "name": author["author"],
        "isProfileImg": author["img"] ? true : false,
        "description": author["description"]
    }));
    summaryObj["author"] = authorArr;

    writeJsonToFile(summaryObj, "summary");
}

async function main() {
    console.log(`GITHUB_CONTEXT_PAYLOAD`, GITHUB_CONTEXT_PAYLOAD);
    const todayDateString = (GITHUB_CONTEXT_PAYLOAD && GITHUB_CONTEXT_PAYLOAD.todayDate) ? GITHUB_CONTEXT_PAYLOAD.todayDate : getFormattedDate(new Date(), true);
    const startRowData = (GITHUB_CONTEXT_PAYLOAD && GITHUB_CONTEXT_PAYLOAD.startRowData) ? GITHUB_CONTEXT_PAYLOAD.startRowData : 1;
    const endRowData = (GITHUB_CONTEXT_PAYLOAD && GITHUB_CONTEXT_PAYLOAD.endRowData) ? GITHUB_CONTEXT_PAYLOAD.endRowData : 1;
    const startRowDataAuthor = (GITHUB_CONTEXT_PAYLOAD && GITHUB_CONTEXT_PAYLOAD.startRowDataAuthor) ? GITHUB_CONTEXT_PAYLOAD.startRowDataAuthor : 1;
    const endRowDataAuthor = (GITHUB_CONTEXT_PAYLOAD && GITHUB_CONTEXT_PAYLOAD.endRowDataAuthor) ? GITHUB_CONTEXT_PAYLOAD.endRowDataAuthor : 1;

    console.log(`todayDateString`, todayDateString);
    console.log(`startRowData`, startRowData);
    console.log(`startRowDataAuthor`, startRowDataAuthor);

    let todayDateRawPath = `backup/${todayDateString}/raw`;
    let todayDateRawAuthorPath = `backup/${todayDateString}/raw-author`;

    let data = [];
    let dataAuthor = [];
    try {
        data = readJsonFromFile(`${BUILD_FOLDER}/${VERSION_NO}/${todayDateRawPath}.json`);
        data = data.items;
        console.log(`file data reading finished`);
    } catch (e) {
        console.log(`file for ${todayDateRawPath} not exist yet`);
    }

    try {
        dataAuthor = readJsonFromFile(`${BUILD_FOLDER}/${VERSION_NO}/${todayDateRawAuthorPath}.json`);
        dataAuthor = dataAuthor.items;
        console.log(`file dataAuthor reading finished`);
    } catch (e) {
        console.log(`file for ${todayDateRawAuthorPath} not exist yet`);
    }

    if (!data.length) {
        data = await geSpreadsheetData();
        writeJsonToFile(data, todayDateRawPath);
    }
    console.log("data.length", data.length)

    if (!dataAuthor.length) {
        dataAuthor = await geSpreadsheetData(isAuthor = true);
        writeJsonToFile(dataAuthor, todayDateRawAuthorPath);
    }
    console.log("dataAuthor.length", dataAuthor.length)

    data = convertArr2ObjArr(data)
    dataAuthor = convertArr2ObjArr(dataAuthor)

    let downloadFileEpubPromises = [];
    let downloadFileCoverPromises = [];
    for (let i = 16; i < 17; i++) {
    for (let i = startRowData - 1; i <= endRowData; i++) {
        let book = data[i];
        downloadFileEpubPromises.push(downloadFile(book["epub-url"], `author/${book["author"]}/${book["name"]}.epub`));
        if (i % 3 == 0 || (i == endRowData)) {
            await Promise.all(downloadFileEpubPromises);
        }
        downloadFileCoverPromises.push(downloadFile(book["cover-url"], `author/${book["author"]}/${book["name"]}.jpg`));
        if (i % 9 == 0 || (i == endRowData)) {
            await Promise.all(downloadFileCoverPromises);
        }
    }

    let downloadFileAuthorCoverPromises = [];
    for (let i = startRowDataAuthor - 1; i <= endRowDataAuthor; i++) {
        let author = dataAuthor[i];
        downloadFileAuthorCoverPromises.push(downloadFile(author["img"], `author/${author["author"]}/profile.jpg`));
        if (i % 18 == 0 || (i == endRowDataAuthor)) {
            await Promise.all(downloadFileAuthorCoverPromises);
        }
    }

    createSummary(data, dataAuthor);
}

main();
