const mongoose = require('mongoose');
let transactionInformation=new mongoose.Schema({
    transactionhash:{
        type:String
    },
    walletaddress:{
        type:String
    },
    tokenId:{
        type:String
    }
})

let transactionModel=mongoose.model('transaction',transactionInformation);
module.exports=transactionModel;


//TRANSACTION SCHEMA