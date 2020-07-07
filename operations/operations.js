var dbf = require('dbf'),
    fs = require('fs');
var DBF = require('stream-dbf');
var moment = require("moment");
// const fsPromises = fs.promises;

function toBuffer(ab) {
    var buffer = new Buffer.alloc(ab.byteLength);
    var view = new Uint8Array(ab);
    for (var i = 0; i < buffer.length; ++i) {
        buffer[i] = view[i];
    }
    return buffer;
}

const update = function(allListRecords, lastUsedValue){
    allListRecords.forEach(element => {
        if(element.FIELDID == 'PIECERAT'){
                element.LASTUSED = lastUsedValue;
        }
    });
    var buf1 = dbf.structure(allListRecords);
    fs.writeFile('./tables/SEZGDGK.DBF', toBuffer(buf1.buffer), function (err) {
        if (err) throw err;
        console.log('Saved!');
      });
    return true;
}


const read = function(path, keyVal, value) {
    let arrayId = {};
    var parser = new DBF(path);
    parser.stream.on('data', function(record) {
        if(value === 'ALLOWMULTI') {
            buf = Buffer.from(record.ALLOWMULTI);
            record.ALLOWMULTI = buf.toJSON().data[0];
        }
        arrayId[record[keyVal]]  = value == "True"? value: record[value];
    });
    return arrayId;
}

const getRecordedQuantity = function(records, jobId) {
    let recordedQuantity = 0;
    // console.log(records);
    for (let element of records) {
        //   console.log(element.STEPCODE, jobId);
        if(Number(element.STEPCODE.trim()) == jobId) {
            //  console.log("True", element.QUANTITY);
            recordedQuantity += element.QUANTITY;
        }
        //  console.log("**",recordedQuantity);
    };
    return recordedQuantity;
}
const isValidUser = function(userArray, userId, id, firstName, arrayIdMultiUser) {
    var flag = false;
    console.log(arrayIdMultiUser, userId, firstName);
    if(userArray[userId] === firstName || arrayIdMultiUser[firstName] === 1) {
        flag = true;
    }

    return flag;
}
const isValidDate = function(date) {
    var y = date.slice(0, 4);
    var m = date.slice(4, 6);
    var d = date.slice(6, 8);
    var quantityDate = moment(y+'-'+m+'-'+d);
    var currentDate = moment();
    var firstdate = moment().startOf('month');
    if(quantityDate <= currentDate && quantityDate >= firstdate) {
        return true;
    } else {
        return false;
    }
}

const getTotalEarningCurrentStyle = function() {
    
}
module.exports ={
    update,
    read,
    getRecordedQuantity,
    isValidUser,
    isValidDate
}