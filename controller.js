const mongoose = require("mongoose");//Mongoose-----
require("./db");//DATABASE------
const express = require("express");//EXPRESS------
const axios = require('axios');//AXIOS------
const path = require("path"); //PATH-------
const router = express.Router();//ROUTER-----
const jwt = require("jsonwebtoken");//JWT-----
const bcrypt = require("bcrypt");//BCRYPT-----
const userModel = require("./model")//SCHEMA-----
const transactionModel = require("./transactionSchema")//SCHEMA-----
const listModel = require("./listSchema")//SCHEMA-----
const PyamentHashModel = require('./transactionHashSchema')//SCHEMA-----
const fs = require("fs")//File-----
const FormData = require('form-data')//FormData-----
router.use(express.json());//use Json format----
const { ethers } = require('ethers')//Ethers-----
//Dotenv---------------
require('dotenv').config();
const pinataApiKey = process.env.PINATA_API_KEY;
const pinataSecretApiKey = process.env.PINATA_SECRET_API_KEY;
const jw = process.env.JWT;
//Multer---------------
const multer = require('multer');
const storage = multer.diskStorage({
    destination: './upload',
    filename: (req, file, cb) => {
        return cb(null, `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`)
    }
})
const upload = multer({
    storage: storage
});
//SendGrid---------
const sgMail = require("@sendgrid/mail");
const { error } = require("console");
const { GRID_API } = process.env;
sgMail.setApiKey(GRID_API);

//API'S------------------------------

//sign up and Email --------
router.post("/signup", async (req, res) => {
    try {
        const { username, email, password, confirmpassword } = req.body;
        const verificationToken = await bcrypt.genSalt(10); //token into hash
        const hashpassword = await bcrypt.hash(password, 10);//password into hash
        const userDetails = new userModel({
            username,
            email,
            password: hashpassword,
            verified: false,
            verificationToken,
            confirmpassword: password,
        })
        if (password != confirmpassword) { res.send("please confirm ppassword") }
        else {
            await userDetails.save()
            const verificationlink = `http://localhost:2100/verify?token=${verificationToken}`;
            const message = {
                to: email,
                from: "hammasali142@gmail.com",
                subject: "SIGN UP TESTING",
                text: `Please click on link to verify your account${verificationToken}`,
                html: `<h> please click on the link to verify email</h><br><a href="${verificationlink}">${verificationlink}</a>`
            }

            await sgMail.send(message);
            res.send("verification email sent to " + email);
        }

    } catch (error) {
        console.log(error)
        res.status(500).send("error occcured")

    }

})
//verification of Email------
router.get("/verify", async (req, res) => {
    try {
        const { token } = req.query;
        const user = await userModel.findOne({ verificationToken: token });
        if (!user) {
            res.send("Invalid Token")
        }
        user.verified = true;
        user.verificationToken = undefined;
        await user.save();
        res.send("your account has been varified")

    } catch (error) {
        console.log(error)
        res.status(500).send("Error Occured")
    }
})
//Login and generate JWT-----
router.post("/login", function (req, res) {
    let username = req?.body?.username;
    let password = req?.body?.password;
    userModel.find({ username: username })
        .exec()
        .then(user => {
            if (user.length < 1) { res.status(404).json({ message: "Authentication Failed" }) }
            else {
                bcrypt.compare(req.body.password, user[0].password, function (err, result) {
                    if (err) {
                        res.status(404).json({
                            message: "Authentication Failed",
                        })
                    }
                    if (result) {

                        let token = jwt.sign(
                            {
                                username: user[0].username,
                                email: user[0].email,
                            }
                            ,

                            "secret", {
                            expiresIn: "1h"
                        }
                        )
                        res.status(201).json({
                            message: "User Find",
                            user: token,
                        })
                    }
                    else {
                        res.status(404).json({ message: "Authentication Failed", })

                    }

                })


            }
        })
        .catch(err => {
            res.json({ error: err })
        })
})
//upload metadata on IPFS and Make transaction-----
router.post("/MintNft", upload.single('file'), async (req, res) => {
    const fn = req.file.filename
    console.log(fn)
    const imagePath = `./upload/${fn}`;
    const metadata = req.body;
    const imagee = fs.readFileSync(imagePath);
    const formData = new FormData();
    formData.append('file', imagee, { filename: `${fn}` });
    try {
        const ress = await axios.post("https://api.pinata.cloud/pinning/pinFileToIPFS", formData, {
            maxBodyLength: "Infinity",
            headers: {
                'Content-Type': `multipart/form-data`,
                pinata_api_key: pinataApiKey,
                pinata_secret_api_key: pinataSecretApiKey,
            }
        });
        const imageHash = ress.data.IpfsHash;
        console.log(imageHash);

        const pinMetadataResponse = await axios.post(
            'https://api.pinata.cloud/pinning/pinJSONToIPFS',
            {
                pinataOptions: {
                    cidVersion: 1,
                },
                pinataMetadata: {
                    name: 'Mint-Testing',
                },
                pinataContent: {
                    attributes: [
                        {
                            color: 'RBG',
                            value: 'Demon',
                        },
                    ],
                    description: 'Demon flying in the skies of heaven',
                    image: `https://gateway.pinata.cloud/ipfs/${imageHash}`,
                    name: 'MINT-NFT',
                },

            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    pinata_api_key: pinataApiKey,
                    pinata_secret_api_key: pinataSecretApiKey,
                },
            }
        );
        const metadataFile = pinMetadataResponse.data.IpfsHash
        console.log(metadataFile);

        const uri = 'https://gateway.pinata.cloud/ipfs/' + metadataFile;
        const walletAddress = req.body.walletAddress;
        console.log(walletAddress)
        mintNFT(walletAddress, uri)

            .then((returnHash) => {
                res.send({ msg: "Minted", hashIS: returnHash });
            })
            .catch((error) => {
                res.status(500).send("Error: " + error);
            });

    } catch (error) {
        console.log(error);
        res.status(500).json({ error: 'An error occurred' });
    }

});
//mint-NFT Function-----
async function mintNFT(walletAddress, uri) {
    try {
        const privateKey = process.env.PRIVATE_KEY; // Fetch private key from environment variable

        // Connect to an Ethereum provider 
        const provider = new ethers.providers.JsonRpcProvider('https://eth-sepolia.g.alchemy.com/v2/3QHJbF2fPFSzmgVnst3pVFdoTXHfDY88');

        // Create a new wallet instance from the private key
        const wallet = new ethers.Wallet(privateKey, provider);

        // Get the current nonce for the wallet address
        const nonce = await provider.getTransactionCount(wallet.address);

        // Build the transaction object
        const contractAddress = '0xCe01fb31021B872890C0aaF9AA2c37A58684F318';
        //contract ABI
        const contractABI = require("./abi")
        const contract = new ethers.Contract(contractAddress, contractABI, wallet);
        const safeTx = await contract.safeMint(walletAddress, uri, { nonce, gasLimit: ethers.utils.hexlify(500000) });
        console.log(safeTx)
        //we done with safetx also we can done it with below commented code----------
        // Sign the transaction
        // const signedTx = await wallet.signTransaction({
        //     ...safeTx,
        //     nonce: nonce,
        //     gasLimit: ethers.utils.hexlify(500000),
        // });

        // // Send the signed transaction
        // const txResponse = await provider.sendTransaction(signedTx);
        // console.log("txResponse: ", txResponse);

        // Wait for the transaction to be mined
        // const receipt = await txResponse.wait();
        // console.log("receipt: ", receipt);

        // Get the transaction hash from the receipt

        const transactionHash = safeTx.hash;
        console.log("Transaction hash: ", transactionHash);


        //make model
        const userDetails = new transactionModel({
            transactionhash: transactionHash,
            walletaddress: walletAddress,
            tokenId: nonce,
        })

        await userDetails.save().then(r => console.log(r)).catch(e => console.log(e))
        return transactionHash

    } catch (error) {
        console.log("Error: ", error);

    }

}
//Make list of the Nft-----
router.post("/list-Nft", async (req, res) => {
    const { tokenId, price, transactionHash, wallet, contractAddress } = req.body;

    listNFT(tokenId, price, transactionHash, wallet, contractAddress)
        // .then(() => {
        //     res.send({msg: "Listing Succesful"});
        // })
        // .catch((error) => {
        //     res.status(500).send("Error: " + error);
        // });
        .then((responseCase) => {
            if (responseCase == 1) {
                res.send({ msg: "List successfully" });

            } else if (responseCase == 2) {
                res.send({ msg: "Error in DB Model" });

            } else if (responseCase == 3) {
                res.send({ msg: "You have not transfer this nft to our escro wallet" });

            } else if (responseCase == 4) {
                res.send({ msg: "You are not the person who perform this transaction" });

            } else {
                res.send({ msg: "There is an other problem " });
            }

            // res.send({ msg: "There is an other problem " });
         })
        .catch((error) => {
            res.status(500).send("Error: " + error);
        });
})
//list-NFT Function-----
async function listNFT(tokenId, price, transactionHash, wallet, contractAddress) {
    // console.log(req.body);
    try {
        let sellerWallet = wallet.toUpperCase();
        let escroWallet = process.env.ESCROWALLET_ADDRESS;
        const provider = new ethers.providers.JsonRpcBatchProvider('https://eth-sepolia.g.alchemy.com/v2/3QHJbF2fPFSzmgVnst3pVFdoTXHfDY88');
        const transaction = await provider.getTransaction(transactionHash);
        console.log(transaction);
        const contractABI = require("./abi")

        if (transaction.from.toUpperCase() == sellerWallet) {
            const nftContractData = new ethers.Contract('0xCe01fb31021B872890C0aaF9AA2c37A58684F318', contractABI, provider);
            console.log(tokenId)
            const owner = await nftContractData.ownerOf(parseInt(tokenId))
            const tokenURI = await nftContractData.tokenURI(tokenId);
            console.log(owner)
            console.log(tokenURI)

            if (owner == escroWallet) {
                try {
                    const response = await axios.get(tokenURI);
                    const metaData = response.data
                    console.log('Meta Data')
                    console.log(metaData)
                    // const transferHashString = JSON.stringify(transferhash);
                    // const attributesString = JSON.stringify(metaData.attributes);
                    const listDetails = new listModel({
                        tokenId,
                        price: price,
                        transferhash: transaction.hash,
                        wallet: metaData.wallet,
                        metadata: {
                            name: metaData.name,
                            description: metaData.description,
                            image: metaData.image,
                            attributes:metaData.attributes,
                        },

                    })
                    
                    await listDetails.save().then(r => console.log(r)).catch(e => console.log(e))
                    return 1

                } catch (error) {
                    console.log("Error In fetching Meta Data From IPFS")
                    return 2

                }
            } else {
                return 3
             }

        } else {
            return 4
        }

    } catch (error) {
        console.log("listing NFT error")
        console.log(error)
    }
}
//get List NFT------
router.get("/listed-Nft", async (req, res) => {
    try {
        const getAll = await listModel.find();
        console.log(getAll)
        res.status(200).send({
            "status": "Succes",
            "message": "Listed Nft's retrieved Succesfully",
            "nfts": getAll
        })

    } catch (error) {
        console.log("Error--")
        res.send({ "message": "fetching from db error" })
    }
    console.log(error)
})
//get all listing details------
router.get("/listed-Nft-Details", async (req, res) => {
    try {
        const { tokenID } = req.body
        
        const nftDetails = await listModel.findOne({tokenId:tokenID});
        console.log(nftDetails)
        console.log(tokenID)
        res.status(200).send({
            "status": "success",
            "message": "NFT detailes retrived succesfully",
            "nft": nftDetails
        })
    } catch (error) {
        console.log("fetching Error")
        console.log(error)
        res.status(404).send({
            "status": "error",
            "message": "fetching error"
        })

    }
})
//BUY-NFT------
router.post("/buy-Nft", async (req, res) => {
    const { nftID, buyer, paymentHash } = req.body;
    console.log(buyer)
    try {
        let buyerWallet = buyer.toUpperCase();
        let escroWallet = process.env.ESCROWALLET_ADDRESS;
        const provider = new ethers.providers.JsonRpcProvider('https://eth-sepolia.g.alchemy.com/v2/3QHJbF2fPFSzmgVnst3pVFdoTXHfDY88');
        const transaction = await provider.getTransaction(paymentHash);
        let valueTransfer = transaction.value.toString();
        const listedTokenDetails = await listModel.findOne({tokenId:nftID});
        console.log("LIsted Token Details")
        console.log(listedTokenDetails.tokenId)
        if (!listedTokenDetails) {
            res.send({
                "status": "error",
                "messsage": "No nft with your Id in our Record"
            })
        }
        try {
            if (transaction.from.toUpperCase() == buyerWallet) {
                if (transaction.to.toUpperCase() == escroWallet.toUpperCase()) {
                    const paymentInDb = PyamentHashModel.findOne({ hash: paymentHash })
                    console.log("payment in DB")
                    console.log(paymentInDb.hash)
                    if (paymentInDb.hash != null) {
                        res.status(400).send({
                            "status": "error",
                            "messsage": "payment is Already Consumed!"
                        })
                        return
                    }
                    const ethValue = ethers.utils.formatEther(valueTransfer)
                    console.log("ETH VALUE")
                    console.log(ethValue)
                    console.log(listedTokenDetails.price)
                    try {
                        const doc = new PyamentHashModel({
                            hash: paymentHash
                        })

                        const resultSaved = await doc.save();
                        if (ethValue >= listedTokenDetails.price) {
                            const transferResult = await transferNft(listedTokenDetails.tokenId, buyer)

                            if (transferResult.status) {
                                const fees = (parseFloat(listedTokenDetails.price) * 2) / 100;
                                const valueTosend = parseFloat(listedTokenDetails.price) - fees;
                                const wallet = new ethers.Wallet(process.env.PRIVATE_KEY_ESCROWALLET, provider)
                                const transactionSendEthes = await wallet.sendTransaction(
                                    {
                                        to: listedTokenDetails.wallet,
                                        value: ethers.utils.parseEther(valueTosend.toString()),
                                        gasLimit: 50000
                                    }
                                )
                                res.status(200).send({
                                    "status": "success",
                                    "message": "Money Transfer to seller and NFT Transfer to Buyer"
                                })
                                return
                            } else {
                                const reverse = await PyamentHashModel.findByIdAndDelete(resultSaved._id)
                                res.status(400).send({
                                    "status": "error",
                                    "message": "Transaction Failed!"
                                })
                                return
                            }

                        }


                    } catch (error) {
                        console.log(error)
                        res.status(200).send({
                            "status": "success",
                            "message": "You have consumed this transaction"
                        })
                        return

                    }
                } else {
                    res.status(400).send({
                        "status": "error",
                        "message": "Payment is not sent to Our Escro Wallet"
                    })
                    return
                }

            } else {
                res.status(400).send({
                    "status": "error",
                    "message": "Buyer is not matched with transaction sender"
                })
                return
            }

        } catch (error) {
            console.log("Inside Error TRY Catch")
            console.log(error)
            res.status(400).send({
                "status": "error",
                "message": "Transation hash metching Error"
            })
            return
        }

    } catch (error) {
        console.log("Fetching Error");
        console.log(error)
        res.status(400).send({
            "status": "error",
            "message": "Fetching Error"
        })
        return

    }
})
//transfer function-----
const transferNft = async (nftId, to) => {

    let contractAddress = '0xCe01fb31021B872890C0aaF9AA2c37A58684F318'
    const abi = require("./abi")
    const provider = new ethers.providers.JsonRpcProvider('https://eth-sepolia.g.alchemy.com/v2/3QHJbF2fPFSzmgVnst3pVFdoTXHfDY88');
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY_ESCROWALLET, provider)
    const sendTx = new ethers.Contract(
        contractAddress,
        abi,
        wallet
    )
    try {
        console.log("Escrow and TO")
        console.log(to)
        console.log(process.env.ESCROWALLET_ADDRESS)
        const dataResult = await sendTx.transferFrom(process.env.ESCROWALLET_ADDRESS, to, nftId, { gasLimit: 50000 })
        await dataResult.wait();

        return {
            status: true,
            hash: dataResult.hash
        }

    } catch (err) {
        console.log("Error in Tranfer NFT");
        console.log(err);
        return {
            status: false,
            hash: "0"
        };
    }


}




// router.post("/upload",upload.single("picture"),(req,res)=>{

// console.log(req.path);
// res.json({
//     success:1,
//     profile_url:`http://localhost:4000/profile/${req.file.filename}`
// })
// })  



module.exports = router;

