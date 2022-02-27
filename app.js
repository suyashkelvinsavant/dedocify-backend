import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import fetch from 'node-fetch';
import sha512 from'crypto-js/sha512.js';
import { ethers } from"ethers";
import fs from 'fs'
const app = express()
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cors({ origin: /http:\/\/(127(\.\d){3}|localhost)/ }));
app.options('*', cors());
import pinataSDK from'@pinata/sdk';
const port = process.env.PORT || 5000
const pinata_api = process.env.PINATA_API_KEY
const pinata_secret = process.env.PINATA_API_SECRET
const pinata = pinataSDK("d9cf89635815aa8e7ffa", "17d1ee72aeec0ee7a24cbf493ca99bb3511b88cb79bffe8ce369fe8be513107b");
const pinata_gateway = "https://gateway.pinata.cloud/ipfs/"

function getHead() {
    try {
        const jsonString = fs.readFileSync('./head.json', 'utf-8');
        const head = JSON.parse(jsonString);
        if(head.head.length > 0){
        return (head.head[head.head.length-1])
        }else{
            return ("")
        } 
    } catch (err) {
        console.log("Parse Head Error", err)
    }
}

function setHead(str) {
    const jsonString = fs.readFileSync('./head.json', 'utf-8');
    const head = JSON.parse(jsonString);
    const arr = head.head
    arr.push(str)
    fs.writeFileSync('./head.json', JSON.stringify({ head: arr }))
}

function checkKeyExists(keyAddress) {
    try {
        const jsonString = fs.readFileSync('./allowed.json', 'utf-8');
        const allowed = JSON.parse(jsonString);
        if (keyAddress in allowed) {
            return true;
        } else {
            return false;
        }
    } catch (err) {
        console.log("Parse Head Error", err)
    }
}

function addUser(keyAddress, limit, data) {
    const jsonString = fs.readFileSync('./allowed.json', 'utf-8');
    const users = JSON.parse(jsonString);
    users[keyAddress] = { limit: limit, data: data }
    fs.writeFileSync('./allowed.json', JSON.stringify(users))
}
async function verifyUser(sign, hash, address, data) {
    const sha_local = sha512(data).toString()
    const computed_address = await ethers.utils.verifyMessage(sha_local, sign)
    if (sha_local === hash && computed_address === address) {
        return true;
    } else {
        return false;
    }
}


app.get('/api', async (req, res) => {
    if (typeof req.query.address !== 'undefined') { 
        const address = req.query.address;
        const keyAddress = address.substring(1)
        const head = getHead();
        if (address.length > 0) {
            if (head === "") {
                res.send({ "error": "No Data In Cloud. Please first send data to receive." })
            } else {
                const resp = await fetch(pinata_gateway + head)
                const index = await resp.json()
                if (typeof index[keyAddress] !== 'undefined') {
                    res.send({ "cid": index[keyAddress] });
                } else {
                    res.send({ "error": "address not defined" })
                    console.log("Error: Address not Defined")
                }
            }
        } else {
            res.send({ "error": "Address Not Found" })
        }
    }
})
app.post('/api', async (req, res) => {
    const requestData = req.body;
    if(typeof requestData.share === 'undefined'){
    if (typeof requestData.address !== 'undefined' && typeof requestData.data !== 'undefined' && typeof requestData.filename !== 'undefined' && typeof requestData.hash !== 'undefined' && typeof requestData.key !== 'undefined' && typeof requestData.sign !== 'undefined') {
        const address = requestData.address
        const keyAddress = address.substring(1)
        const sign = requestData.sign
        const data = requestData.data
        const fileName = requestData.filename
        const hash = requestData.hash
        const key = requestData.key
        if (verifyUser(sign, hash, address, data)) {
            if (checkKeyExists(keyAddress)) {
                const three_result = await pinata.pinJSONToIPFS({ "filename": fileName, "data": data })
                const head = getHead();
                
                if (head === "") {
                    const two_result = await pinata.pinJSONToIPFS({ "address": address, "key": key, files: [{ "filename": fileName, "id": three_result.IpfsHash }],share: [] });
                    const one_result = await pinata.pinJSONToIPFS({ "level": "one", [keyAddress]: two_result.IpfsHash });
                    setHead(one_result.IpfsHash);
                    res.send({ "cid": two_result.IpfsHash })
                } else {
                    const one_resp = await fetch(pinata_gateway + head)
                    const one_index = await one_resp.json()
                    if (typeof one_index[keyAddress] !== 'undefined') {
                        const two_resp = await fetch(pinata_gateway + one_index[keyAddress]) 
                        const two_index = await two_resp.json()
                        two_index.files.push({ "filename": fileName, "id": three_result.IpfsHash })
                        const modified_two_result = await pinata.pinJSONToIPFS(two_index)
                        pinata.unpin(one_index[keyAddress])
                        one_index[keyAddress] = modified_two_result.IpfsHash
                        const modified_one_result = await pinata.pinJSONToIPFS(one_index)
                        pinata.unpin(head)
                        setHead(modified_one_result.IpfsHash)
                        res.send({ "cid": modified_two_result.IpfsHash })
                    } else {
                        res.send({ "error": "address not defined" })
                        console.log(err)
                    }
                }

            } else {
                console.log('failed')
            }
        } else {
            console.log("Authentication Failed")
        }
    }}else{
        console.log("hello 1")
        if (typeof requestData.share !== 'undefined' && typeof requestData.address !== 'undefined' && typeof requestData.data !== 'undefined' && typeof requestData.filename !== 'undefined' && typeof requestData.hash !== 'undefined' && typeof requestData.key !== 'undefined' && typeof requestData.sign !== 'undefined'&& requestData.filename !== "") {
            const address = requestData.address
            const keyAddress = address.substring(1)
            const sign = requestData.sign
            const data = requestData.data
            const fileName = requestData.filename
            const hash = requestData.hash
            const key = requestData.key
            const share = requestData.share
            if (verifyUser(sign, hash, address, data)) {
                if (checkKeyExists(keyAddress)) {
                    const three_result = await pinata.pinJSONToIPFS({ "filename": fileName, "data": data, "key": share })
                    const head = getHead();
                    
                    if (head === "") {
                        const two_result = await pinata.pinJSONToIPFS({ "address": address, "key": key, files: [], share: [{ "filename": fileName, "id": three_result.IpfsHash,"key": share }] });
                        const one_result = await pinata.pinJSONToIPFS({ "level": "one", [keyAddress]: two_result.IpfsHash });
                        setHead(one_result.IpfsHash);
                        res.send({ "cid": three_result.IpfsHash })
                    } else {
                        const one_resp = await fetch(pinata_gateway + head)
                        const one_index = await one_resp.json()
                        if (typeof one_index[keyAddress] !== 'undefined') {
                            const two_resp = await fetch(pinata_gateway + one_index[keyAddress]) 
                            const two_index = await two_resp.json()
                            if(typeof two_index.share !== 'undefined'){
                            two_index.share.push({ "filename": fileName, "id": three_result.IpfsHash, "key": share })
                            const modified_two_result = await pinata.pinJSONToIPFS(two_index)
                            pinata.unpin(one_index[keyAddress])
                            one_index[keyAddress] = modified_two_result.IpfsHash
                            const modified_one_result = await pinata.pinJSONToIPFS(one_index)
                            pinata.unpin(head)
                            setHead(modified_one_result.IpfsHash)
                            res.send({ "cid": three_result.IpfsHash })
                            }else{
                            two_index.share=[{ "filename": fileName, "id": three_result.IpfsHash, "key": share }]
                            const modified_two_result = await pinata.pinJSONToIPFS(two_index)
                            pinata.unpin(one_index[keyAddress])
                            one_index[keyAddress] = modified_two_result.IpfsHash
                            const modified_one_result = await pinata.pinJSONToIPFS(one_index)
                            pinata.unpin(head)
                            setHead(modified_one_result.IpfsHash)
                            res.send({ "cid": three_result.IpfsHash })
                            }
                        } else {
                            res.send({ "error": "address not defined" }) 
                            console.log(err)
                        }
                    }
    
                } else {
                    console.log('failed')
                }
            } else {
                console.log("Authentication Failed")
            }
        }
    }
    
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})

