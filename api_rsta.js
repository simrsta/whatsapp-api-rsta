const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const express = require('express');
const { body, validationResult} = require('express-validator');
const bodyParse = require('body-parser');
const socketIO = require('socket.io');
const qrcode = require('qrcode');
const http = require('http');
const fs = require('fs');
const { phoneNumberFormatter } = require('./helpers/formatter');
const { response } = require('express');
const { group } = require('console');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);
var jsonParser = bodyParse.json({limit: '35mb'});
var encodedParser = bodyParse.urlencoded({
    extended: true,
    parameterLimit: 1000000,
    limit: '35mb',
});

app.use(express.json());
app.use(express.urlencoded({
    extended: true,
    parameterLimit: 1000000,
    limit:"50mb"
}));

const SESSION_FILE_PATH = './api_rsta_session.json';
let sessionCfg;
if(fs.existsSync(SESSION_FILE_PATH)) {
    sessionCfg = require(SESSION_FILE_PATH);
}

app.get('/', (req, res) => {
    res.sendFile('index.html', {root: __dirname});
});

const client = new Client({
    restartOnAuthFail: true,
    puppeteer: {
        headless: true,
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-accelerated-2d-canvas",
            "--no-first-run",
            "--no-zygote",
            "--single-process", // <- this one doesn't works in Windows
            "--disable-gpu",
            "--unhandled-rejections=none",
            "--trace-warnings",
            ],
        },
        authStrategy: new LocalAuth()
    }
);

client.on('message', msg => {

    console.log('-incoming msg :'+msg.body);
    msg.reply('Hai ka, mohon maaf nomor WA ini hanya dapat mengirim pesan keluar saja. Apabila ingin bertanya, klik link berikut  ya :\n\nhttps://wa.me/6281510175667 (RSUD Tanah Abang)\n\n(ini adalah pesan otomatis)');
    // msg.reply('pesan dikirim');
    // if(msg.body == '!ping') {
    //     msg.reply('pong');
    // } else if(msg.body == 'good morning') {
    //     msg.reply('selamat pagi');
    // } else if(msg.body == '!groups') {
    //     client.getChats().then(chats => {
    //         const groups = chats.filter(chat => chat.isGroup);

    //         if(groups.length == 0) {
    //             msg.reply('You have no group yet');
    //         } else {
    //             let replyMsg = '*YOUR GROUP*\n\n';
    //             group.forEach((group, i) => {
    //                 replyMsg += `ID: ${group.id._serialized}\nName: ${group.name}\n\n`;
    //             });
    //             replyMsg += '_You can use the group id to send a message to the group._';
    //             msg.reply(replyMsg);
    //         }
    //     });
    // }
});

client.initialize();

// socket.io
io.on('connection', function(socket) {
    socket.emit('message', 'Connecting..');

    client.on('qr', (qr) => {
        // console.log('QR RECEIVED', qr);
        qrcode.toDataURL(qr, (err, url) => {
            socket.emit('qr', url);
            socket.emit('message', 'QR Code received. Please scan');
        });
    });

    client.on('ready', () => {
        // client.sendMessage('')
        socket.emit('message', 'Whatsapp is ready');
    });

    client.on('authenticated', () => {
        socket.emit('message', 'Whatsapp is authenticated');
    });

    client.on('auth_failure', function(session){
        socket.emit('message', 'Auth failure, restarting..');
    });

    client.on('disconnected', (reason) => {
        socket.emit('message', 'Whatsapp is disconnected');
        client.destroy();
        client.initialize();
    });
});

const checkRegisteredNumber = async function(number) {
    const isRegistered = await client.isRegisteredUser(number);
    return isRegistered;
}

// send message
app.post(
    '/send-message',
    [body("number").notEmpty(), body("message").notEmpty()],
    async (req, res) => {
        const errors = validationResult(req).formatWith(({msg}) => {
            return msg;
        });
        
        if(!errors.isEmpty) {
            return res.status(422).json({
                status: false,
                message: errors.mapped()
            });
        }

        const number = phoneNumberFormatter(req.body.number);
        const message = req.body.message;

        const isRegisteredNumber = await checkRegisteredNumber(number).catch(err => {
            console.log('-- error checkRegisteredNumber ('+number+'): '+err);
        });
        
        if(!isRegisteredNumber) {
            return res.status(422).json({
                status: false,
                message: 'The number is not registered'
            });
        }

        
        // socket.emit('message', 'destination message to '+number);
        client.sendMessage(number, message).then(response => {
            res.status(200).json({
                status: true,
                response: response
            });
        }).catch(err => {
            res.status(500).json({
                status: false,
                response: err
            });
        });
    }
);

// send pdf
app.post(
    '/send-pdf-base64',
    [body("number").notEmpty(), body("pdf_base64").notEmpty()], 
    async(req, res) => {

        const number = phoneNumberFormatter(req.body.number);
        const base64 = req.body.pdf_base64;
        const file_name = req.body.pdf_filename;

        const isRegisteredNumber = await checkRegisteredNumber(number).catch(err => {
            console.log('-- error checkRegisteredNumber ('+number+'): '+err);
        });
        
        if(!isRegisteredNumber) {
            return res.status(422).json({
                status: false,
                message: 'The number is not registered'
            });
        }

        const media = new MessageMedia('application/pdf', base64, file_name);

        client.sendMessage(number, media).then(response => {
            res.status(200).json({
                status: true,
                response: response
            });
        }).catch(err => {
            res.status(500).json({
                status: false,
                response: err
            });
        });


});

// send png
app.post(
    '/send-png-base64',
    [body("number").notEmpty(), body("png_base64").notEmpty()], 
    async(req, res) => {

        const number = phoneNumberFormatter(req.body.number);
        const base64 = req.body.png_base64;
        const file_name = req.body.png_filename;

        const isRegisteredNumber = await checkRegisteredNumber(number).catch(err => {
            console.log('-- error checkRegisteredNumber ('+number+'): '+err);
        });
        
        if(!isRegisteredNumber) {
            return res.status(422).json({
                status: false,
                message: 'The number is not registered'
            });
        }

        const media = new MessageMedia('image/png', base64, file_name);

        client.sendMessage(number, media).then(response => {
            res.status(200).json({
                status: true,
                response: response
            });
        }).catch(err => {
            res.status(500).json({
                status: false,
                response: err
            });
        });


});

// send jpg jpeg
app.post(
    '/send-jpg-base64',
    [body("number").notEmpty(), body("jpg_base64").notEmpty()], 
    async(req, res) => {

        const number = phoneNumberFormatter(req.body.number);
        const base64 = req.body.jpg_base64;
        const file_name = req.body.jpg_filename;

        const isRegisteredNumber = await checkRegisteredNumber(number).catch(err => {
            console.log('-- error checkRegisteredNumber ('+number+'): '+err);
        });
        
        if(!isRegisteredNumber) {
            return res.status(422).json({
                status: false,
                message: 'The number is not registered'
            });
        }

        const media = new MessageMedia('image/jpeg', base64, file_name);

        client.sendMessage(number, media).then(response => {
            res.status(200).json({
                status: true,
                response: response
            });
        }).catch(err => {
            res.status(500).json({
                status: false,
                response: err
            });
        });


});

server.listen(8001, function() {
    console.log('App running on *: 8001');
});

