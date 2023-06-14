//userSchema
const mongoose = require('mongoose');
let userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        index: {
            unique: true,
        }
    },
    email: {
        type: String,
        required: true,
    },
    password: {
        type: String,
        required: true,

    },

    verified: {
        type: Boolean

    },
    verificationToken: {
        type: String
    },

    date: {
        type: Date,
        default: Date.now
    }
});


let userModel = mongoose.model('user', userSchema);
module.exports = userModel;

