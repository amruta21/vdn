var TelegramBot = require('node-telegram-bot-api'),
    // Be sure to replace YOUR_BOT_TOKEN with your actual bot token on this line.
    telegram = new TelegramBot("<api_key>", { polling: true });

var operations = require("./operations/operations");
var DBF = require('stream-dbf');
const arrayId = operations.read("./tables/EPL.DBF", 'EPL_ID', "True");
const arrayProductId = operations.read("./tables/gmstyle.DBF", 'STL_ID', "True");
const arraySMV = operations.read("./tables/gmstyle.DBF", 'EPL_ID', 'SMV_RATE');


var parserJobID = new DBF("./tables/qtcnchitiet.DBF");

var parserList = new DBF("./tables/SEZGDGK.DBF");
var parserCompany = new DBF("./tables/company.DBF");


var arrayQuantityId = {};
var arrayJobID = {};
var arrayEarning = {};
var arrayHeso = {};
var lastUsedValue, LBCOSTPERS;
var allListRecords = [];

var DBFFile = require('dbffile');


async function recordWrite(records) {
    let dbf = await DBFFile.DBFFile.open('./tables/PIECERATERECORD.DBF');

    await dbf.appendRecords(records);
    console.log(`${records.length} records added.`);
}

async function updateTable(records, lastValue) {
    operations.update(records, lastValue);
}

parserJobID.stream.on('data', function (record) {
    arrayJobID[record.ROW_ID] = record.STL_ID;
    arrayEarning[record.ROW_ID] = record.THOIGIAN + record.TGTHAOTAC + record.TGSUAHANG;
    arrayHeso[record.ROW_ID] = record.HESO;
});


parserList.stream.on('data', function (record) {
    allListRecords.push(record);
    if (record['FIELDID'] === 'PIECERAT') {
        lastUsedValue = parseInt(record['LASTUSED']);
        itr = parseInt(record['LASTUSED']);
    }
});

parserCompany.stream.on('data', function (record) {
    LBCOSTPERS = record.LBCOSTPERS;
});

telegram.on("text", (message) => {
    var allListRecordsQuantity = [];
    var parserQuantity = new DBF("./tables/PIECERATERECORD.DBF");
    parserQuantity.header.fields[7].raw = true;
    parserQuantity.stream.on('data', function (record) {
        buf = Buffer.from(record.QUANTITY);
        record.QUANTITY = buf.toJSON().data[0];
        arrayQuantityId[record.ROWID] = buf.toJSON().data[0];
        allListRecordsQuantity.push(record);
    });
    msgArray = message.text.split(",");
    var errorFlag = false;
    var msg = "";
    var earning = 0;
    var jobQuantityList = 2;
    var jobFlag, quantityFlag;
    var bufInsertValue = [];
    var msgQuant = "";
    var userId = msgArray[0].replace(/ +/g, "").trim().toUpperCase();
    var prodctID = msgArray[1] ? msgArray[1].replace(/ +/g, "").trim().toUpperCase() : "";

    setTimeout(function () {
        if ((msgArray.length == 1 || msgArray.length == 2) && msgArray[0] !== "botmappedevent") {
            msg = `Em không hiểu.Hãy gửi lại tin nhắn theo mẫu này:  Mã_Nhân_Viên, Mã_Sản_Phẩm, MãCĐ1/SốLượng1,MãCĐ2/SL2, MãCĐ3/SL3 ….

            Ví dụ
            NV000, 1111A, 11111/222, 3333/444, 5555/666`;
            errorFlag = true;
            telegram.sendMessage(message.chat.id, msg);
        }
        if (msgArray[0] !== "botmappedevent" && errorFlag === false) {
            while (msgArray.length !== 1 && msgArray.length != jobQuantityList && msgArray[jobQuantityList].split("/")[0].length) {
                var insertFlag = false;
                if (msgArray[jobQuantityList].split("/")[0] && msgArray[jobQuantityList].split("/")[1]) {
                    var jobId = (msgArray[jobQuantityList].split("/")[0]).replace(/ +/g, "").trim().toUpperCase();
                    var quantityId = (msgArray[jobQuantityList].split("/")[1]).replace(/ +/g, "").trim().toUpperCase();

                    if (arrayJobID[jobId] === prodctID) {
                        jobFlag = true;
                        const isNumber = Number.isInteger(Number((msgArray[jobQuantityList].split("/")[1]).trim().toUpperCase()));
                        const recordedQuantity = operations.getRecordedQuantity(allListRecordsQuantity, jobId);
                        const remainingQuantity = arrayQuantityId[(msgArray[jobQuantityList].split("/")[0]).trim().toUpperCase()] - recordedQuantity;
                        if (remainingQuantity > (msgArray[jobQuantityList].split("/")[1]).trim().toUpperCase() && isNumber) {
                            quantityFlag = quantityFlag == false ? false : true;
                            earning = earning + getTotalEarning(quantityId, arrayEarning[jobId], LBCOSTPERS, arrayHeso[jobId], arraySMV[quantityId]);
                            msgQuant += msgArray[jobQuantityList] + ": ok,";
                            insertFlag = true;
                        } else if (remainingQuantity > 0 && isNumber) {
                            quantityFlag = quantityFlag == false ? false : true;
                            earning = earning + getTotalEarning(remainingQuantity, arrayEarning[jobId], LBCOSTPERS, arrayHeso[jobId], arraySMV[quantityId]);
                            msgQuant += msgArray[jobQuantityList] + ": " + remainingQuantity + " ,";
                            insertFlag = true;
                        } else {
                            msgQuant += msgArray[jobQuantityList] + ": 0 Sai,"
                            jobFlag = jobFlag == false ? false : true;
                        }
                    } else {
                        msgQuant += msgArray[jobQuantityList] + ": Sai,"
                        jobFlag = jobFlag == false ? false : true;
                    }
                    if (insertFlag == true) {
                        var today = new Date();
                        var date = (today.getDate() < 10 ? ('0' + today.getDate()) : today.getDate()) + ((today.getMonth() + 1) < 10 ? ('0' + (today.getMonth() + 1)) : (today.getMonth() + 1)) + today.getFullYear();
                        bufInsertValue.push({
                            ROWID: (lastUsedValue + 1).toString() + 'bot',
                            COMPANY: '',
                            FACTORY: '',
                            DATE: date.toString(),
                            WORKER: msgArray[0],
                            STEPCODE: (msgArray[jobQuantityList].split("/")[0]).toString(),
                            STEPNUMBER: '\u0000\u0000\u0000\u0000',
                            QUANTITY: parseInt(msgArray[jobQuantityList].split("/")[1]),
                            C1: msgArray[1],
                            C2: '',
                            C3: '',
                            C4: '',
                            C5: '',
                            N1: '\u0000\u0000\u0000\u0000',
                            N2: '\u0000\u0000\u0000\u0000',
                            N3: '\u0000\u0000\u0000\u0000',
                            N4: '\u0000\u0000\u0000\u0000',
                            N5: '\u0000\u0000\u0000\u0000'
                        });
                        lastUsedValue++;
                    }
                } else if(errorFlag === false){
                    errorFlag = true;
                    msg = `Em không hiểu.Hãy gửi lại tin nhắn theo mẫu này:  Mã_Nhân_Viên, Mã_Sản_Phẩm, MãCĐ1/SốLượng1,MãCĐ2/SL2, MãCĐ3/SL3 ….

                    Ví dụ
                    NV000, 1111A, 11111/222, 3333/444, 5555/666`;
                    
                    telegram.sendMessage(message.chat.id, msg);

                    jobQuantityList = msgArray.length - 1;
                }
                jobQuantityList++;
            }
            var validInsert = false;
            if (msgArray.length > 2 && arrayId[userId] == "True") {
                msg += userId + ": ok, ";
                validInsert = true;
            }
            else if (msgArray.length > 2)
                msg += userId + ": Sai, ";

            if (msgArray.length > 2 && arrayProductId[prodctID] == "True") {
                msg += prodctID + ": ok, " + msgQuant;
                validInsert = validInsert == false ? false : true;
            } else if (msgArray.length > 2) {
                msg += prodctID + ": Sai" + msgQuant;
                validInsert = false;
            }
            if (validInsert == true && quantityFlag == true && jobFlag == true) {
                msg += "- Lương sản phẩm đã nhập: " + earning.toLocaleString('en-US', {maximumFractionDigits:2}) + "vnd – Đã nhập toàn bộ";
                insertQuantity(bufInsertValue);
                updateTable(allListRecords, lastUsedValue);

            } else if (validInsert == true && quantityFlag == true && jobFlag == false) {
                msg += "- Lương sản phẩm đã nhập: " + earning.toLocaleString('en-US', {maximumFractionDigits:2}) + "vnd – Đã nhập một phần";
                insertQuantity(bufInsertValue);
            } else {
                msg += "- Lương sản phẩm đã nhập: 0vnd – KHÔNG NHẬP";
            }
            if (msgArray.length > 2 && errorFlag === false){
                telegram.sendMessage(message.chat.id, msg);
            }
        }
    }, 1000);
});

function insertQuantity(bufferArray) {
    recordWrite(bufferArray);
}

function getTotalEarning(quantity, allowed_time, LBCOSTPERS, heso, smvRate = 1) {
    return (parseFloat(quantity) * parseFloat(allowed_time) * parseFloat(LBCOSTPERS) * parseFloat(heso) * parseFloat(smvRate));
}
// telegram.on("text", (message) => {
//     console.log(message.text);
//     telegram.sendMessage(message.chat.id, "Hello world");
// });
