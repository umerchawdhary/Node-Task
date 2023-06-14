//ListSchema
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let ListSchema = new mongoose.Schema({
    tokenId: {
        type: String,
       
    },
    price: {
        type: String,
       
    },
    transferhash:{
        type:String,
    },
    wallet:{
        type:String,
    },
    metadata:{
        name:{type:String},
        description:{type:String},
        image:{type:String},
        attributes:[{ type: Schema.Types.Mixed }],
    },
});
let listModel=mongoose.model('list',ListSchema);
module.exports=listModel;