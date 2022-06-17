const axios = require('axios').default;
const fs = require('fs');
const https = require('https'); // or 'https' for https:// URLs

const SPREADSHEET_SECRETKEY = process.env.SPREADSHEET_SECRETKEY;
const GITHUB_CONTEXT_PAYLOAD = process.env.GITHUB_CONTEXT_PAYLOAD ? JSON.parse(process.env.GITHUB_CONTEXT_PAYLOAD) : '';
const BUILD_FOLDER = 'build';
const VERSION_NO = 'v1';

async function geSpreadsheetData() {
    let data = [];
    try {
        const response = await axios.get(`https://sheets.googleapis.com/v4/spreadsheets/1bPsbxgOeHLZIVkJS5Zj59AKNSnZbOI22P8ENP7hhewk/values/Sheet1?key=${SPREADSHEET_SECRETKEY}`);
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

function downloadEpub(fileUrl, fileName) {
    return new Promise((resolve, reject) => {
        console.log("donwloadEpub", fileUrl)
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

async function main() {
    console.log(`GITHUB_CONTEXT_PAYLOAD`, GITHUB_CONTEXT_PAYLOAD);
    const serverTodayDate = (GITHUB_CONTEXT_PAYLOAD && GITHUB_CONTEXT_PAYLOAD.todayDate) ? GITHUB_CONTEXT_PAYLOAD.todayDate : '';
    let todayDateString = getFormattedDate(new Date(), true);
    if (serverTodayDate) {
        todayDateString = serverTodayDate;
    }
    console.log(`todayDateString`, todayDateString);
    let todayDateRawPath = `backup/${todayDateString}/raw`;

    let data = [];
    try {
        data = readJsonFromFile(`${BUILD_FOLDER}/${VERSION_NO}/${todayDateRawPath}.json`);
        data = data.items;
        console.log(`file reading finished`);
    } catch (e) {
        console.log(`file for ${todayDateRawPath} not exist yet`);
    }

    console.log("data.length", data.length)
    if (!data.length) {
        data = await geSpreadsheetData();
        writeJsonToFile(data, todayDateRawPath);
    }

    data = convertArr2ObjArr(data)

    for (let i = 0; i < data.length; i++) {
        let book = data[i];
        await downloadEpub(book["epub-url"], `author/${book["author"]}/${book["name"]}.epub`)
        break;
    }
}

main();
