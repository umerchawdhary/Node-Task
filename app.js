
const express = require('express')//Express---
const router = require('./controller.js');//Controller File---    
const db = require('./db')//Database---
const app = express();//Create App---
app.use(express.json());//Use Json---
app.use('/userApi', router);//ImportRouter---
app.use('/profile',express.static('/upload'))//UploadUsingUpload---
const PORT = 3000//---
const start = async () => {
    try {
        await db();
        app.listen(PORT, () => {
            console.log(`server is running at port ${PORT}`);
        });
    } catch (error) {
        console.log(error);
    }
};
start();