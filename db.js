//connect DataBase
const mongoose = require('mongoose');
const db = ()=>{mongoose.connect('mongodb://localhost:27017/NODETASK')
.then(() => console.log('conected to MOngodb'))
.catch(err => console.error('Not connected to MOngodb', err))
}
module.exports=db;
