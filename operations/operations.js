var dbf = require('dbf'),
    fs = require('fs');
var DBF = require('stream-dbf');
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
        arrayId[record[keyVal]]  = value == "True"? value: record[value];
    });
    return arrayId;
}

const getRecordedQuantity = function(records, jobId) {
    let recordedQuantity = 0;
    records.forEach(element => {
        // console.log(element.STEPCODE, jobId);
        if(element.ROWID.includes("bot") && element.STEPCODE == jobId) {
            // console.log("True");
            recordedQuantity += element.QUANTITY;
        }
    });
    // console.log(recordedQuantity);
    return recordedQuantity;
}
module.exports ={
    update,
    read,
    getRecordedQuantity
}