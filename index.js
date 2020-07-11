var TelegramBot = require('node-telegram-bot-api'),
    // Be sure to replace YOUR_BOT_TOKEN with your actual bot token on this line.
    telegram = new TelegramBot("Telegram_Id", { polling: true });

var operations = require("./operations/operations");
var DBF = require('stream-dbf');
const arrayId = operations.read("./tables/EPL.DBF", 'EPL_ID', "True");
const arrayIdName = operations.read("./tables/EPL.DBF", 'EPL_ID', 'TELUSERNAM');
const arrayIdMultiUser = operations.read("./tables/EPL.DBF", 'TELUSERNAM', 'ALLOWMULTI');
const arrayProductId = operations.read("./tables/gmstyle.DBF", 'STL_ID', "True");
const arraySMV = operations.read("./tables/gmstyle.DBF", 'EPL_ID', 'SMV_RATE');
const arrayRQR = operations.read("./tables/gmstyle.DBF", 'STL_ID', 'STL_RQRQTY');


var parserJobID = new DBF("./tables/qtcnchitiet.DBF");

var parserList = new DBF("./tables/SEZGDGK.DBF");
var parserCompany = new DBF("./tables/company.DBF");


var arrayQuantityId = {};
var arrayJobID = {};
var arrayEarning = {};
var arrayHeso = {};
var lastUsedValue, LBCOSTPERS;
var allListRecords = [];
var arraySochitiet = [];
var allListRecordsQuantity = [];

var monthEarning = 0;
var styleEarning = 0;


var DBFFile = require('dbffile');

async function readRecord(arrayQuantityId, userId, prodctID) {
    let dbf =  await DBFFile.DBFFile.open('./tables/PIECERATERECORD.DBF')
    let records =  await dbf.readRecords(100000);
    for (let record of records) {

        if(record.ROWID.includes("bot")) {
            arrayQuantityId[record.STEPCODE+":"+record.ROWID] = record.QUANTITY;
        } else {
            arrayQuantityId[record.STEPCODE] = record.QUANTITY;
        }
        const flagValid = operations.isValidDate(record.DATE);
        if(flagValid === true && record.WORKER.trim().toUpperCase() === userId.toUpperCase() && record.C1.trim().toUpperCase() === prodctID.toUpperCase()) {
            monthEarning += getTotalEarning(record.QUANTITY, arrayEarning[record.STEPCODE.trim().toString()], LBCOSTPERS, arrayHeso[record.STEPCODE.trim().toString()], arraySMV[record.QUANTITY]);
        }
        if(record.WORKER.trim().toUpperCase() === userId.toUpperCase() && record.C1.trim().toUpperCase() === prodctID.toUpperCase()) {
            
            styleEarning += getTotalEarning(record.QUANTITY, arrayEarning[record.STEPCODE.trim().toString()], LBCOSTPERS, arrayHeso[record.STEPCODE.trim().toString()], arraySMV[record.QUANTITY]);
        }
        allListRecordsQuantity.push(record);
    }
}
async function recordWrite(records) {
    let dbf = await DBFFile.DBFFile.open('./tables/PIECERATERECORD.DBF');

    await dbf.appendRecords(records);
    console.log(`${records.length} records added.`);
}

async function updateTable(records, lastValue) {
    operations.update(records, lastValue);
}

function getMaxQuantity(arrayRQR, arraySochitiet, prodctID, jobId) {
    const maxQuantity  = arraySochitiet[jobId] * arrayRQR[prodctID]
    console.log( "jobid"+ jobId, "Sochitiet"+arraySochitiet[jobId] , "arrayRQR[prodctID]" + arrayRQR[prodctID], "Max Quantity" +maxQuantity);
    return maxQuantity;
}

parserJobID.stream.on('data', function (record) {
    arrayJobID[record.ROW_ID] = record.STL_ID;
    buf = Buffer.from(record.TGTHAOTAC);
    record.TGTHAOTAC = buf.toJSON().data[0];
    buf = Buffer.from(record.TGSUAHANG);
    record.TGSUAHANG = buf.toJSON().data[0];
    arrayEarning[record.ROW_ID] = record.THOIGIAN + record.TGTHAOTAC + record.TGSUAHANG;
    arrayHeso[record.ROW_ID] = record.HESO;
    buf = Buffer.from(record.SOCHITIET);
    record.SOCHITIET = buf.toJSON().data[0];
    arraySochitiet[record.ROW_ID] = record.SOCHITIET;
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
    console.log("**************"+message.text+"*****************************");
    allListRecordsQuantity = [];
    monthEarning = 0;
    styleEarning = 0;
    
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
    var valid = operations.isValidUser(arrayIdName,userId, message.from.id, message.from.username, arrayIdMultiUser);

    readRecord(arrayQuantityId, userId, prodctID);
    setTimeout(function () {
        if(valid) {
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
                            console.log("recorded", recordedQuantity, "jobId"+jobId);
                            const remainingQuantity = getMaxQuantity(arrayRQR, arraySochitiet, prodctID, jobId) - recordedQuantity;
                            console.log("remainingQuantity", remainingQuantity);
                            if (remainingQuantity > (msgArray[jobQuantityList].split("/")[1]).trim().toUpperCase() && isNumber) {
                                quantityFlag = quantityFlag == false ? false : true;
                                earning = earning + getTotalEarning(quantityId, arrayEarning[jobId], LBCOSTPERS, arrayHeso[jobId], arraySMV[quantityId]);
                                msgQuant += msgArray[jobQuantityList] + ": ok,";
                                insertFlag = "full";
                            } else if (remainingQuantity > 0 && isNumber) {
                                quantityFlag = quantityFlag == false ? false : true;
                                earning = earning + getTotalEarning(remainingQuantity, arrayEarning[jobId], LBCOSTPERS, arrayHeso[jobId], arraySMV[quantityId]);
                                msgQuant += msgArray[jobQuantityList] + ": " + remainingQuantity + " ,";
                                insertFlag = remainingQuantity;
                            } else {
                                msgQuant += msgArray[jobQuantityList] + ": 0 Sai,"
                                jobFlag = jobFlag == false ? false : true;
                            }
                        } else {
                            msgQuant += msgArray[jobQuantityList] + ": Sai,"
                            jobFlag = jobFlag == false ? false : true;
                        }
                        if (insertFlag !== false) {
                            var today = new Date();
                            var date = today.getFullYear() + ((today.getMonth() + 1) < 10 ? ('0' + (today.getMonth() + 1)) : (today.getMonth() + 1)) + (today.getDate() < 10 ? ('0' + today.getDate()) : today.getDate());
                            bufInsertValue.push({
                                ROWID: (lastUsedValue + 1).toString() + 'bot',
                                COMPANY: '',
                                FACTORY: '',
                                DATE: date.toString(),
                                WORKER: msgArray[0],
                                STEPCODE: (msgArray[jobQuantityList].split("/")[0]).toString(),
                                STEPNUMBER: '\u0000\u0000\u0000\u0000',
                                QUANTITY: insertFlag === "full" ? parseInt(quantityId): parseInt(insertFlag),
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
                    styleEarning +=  earning;
                    monthEarning +=  earning;
                    msg += "...  Tổng lương SP của mã hàng  "+ styleEarning.toLocaleString('en-US', {maximumFractionDigits:2})  + "vnd, ";
                    msg += "  Tổng lương SP trong tháng  " + monthEarning.toLocaleString('en-US', {maximumFractionDigits:2}) + "vnd";
                    telegram.sendMessage(message.chat.id, msg);
                }
            }
        } else {
            telegram.sendMessage(message.chat.id, "Bạn chưa đăng ký với nhân sự. Vui lòng đăng ký trước khi gửi tin nhắn sản lượng");
        }
    }, 1000);
});

function insertQuantity(bufferArray) {
    recordWrite(bufferArray);
}

function getTotalEarning(quantity, allowed_time, LBCOSTPERS, heso, smvRate = 1) {
    // console.log(parseFloat(quantity), parseFloat(allowed_time), parseFloat(LBCOSTPERS) , parseFloat(heso) , parseFloat(smvRate));
    return (parseFloat(quantity) * parseFloat(allowed_time) * parseFloat(LBCOSTPERS) * parseFloat(heso) * parseFloat(smvRate));
}