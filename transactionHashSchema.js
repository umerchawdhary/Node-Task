const mongoose=require("mongoose");

const  pyamentHashSchema = new mongoose.Schema({
    hash: {type: String , unique: true ,   required: true },
});

const PyamentHashModel = mongoose.model('paymenthash' , pyamentHashSchema);

module.exports=PyamentHashModel;


//TRANSACTION HASH SCHEMA