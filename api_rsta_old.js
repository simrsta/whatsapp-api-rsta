
const { Client } = require('whatsapp-web.js');
const express = require('express');
const { body, validationResult} = require('express-validator');
const socketIO = require('socket.io');
const qrcode = require('qrcode');
const http = require('http');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.use(express.json());
app.use(express.urlencoded({extended: true}));

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
    }
);

client.on('qr', (qr) => {
    // Generate and scan this code with your phone
    console.log('QR RECEIVED', qr);
    qrcode.generate(qr);
});

client.on('authenticated', () => {
    console.log('AUTHENTICATED');
});

client.on('auth_failure', msg => {
    console.error('AUTH_ERROR ',msg);
});

client.on('ready', () => {
    console.log('Client is ready!');
});

client.on('message', msg => {
    if (msg.body == '!ping') {
        msg.reply('pong');
    }
});

client.initialize();

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

        const number = req.body.number;
        const message = req.body.message;

        const isRegisteredNumber = await checkRegisteredNumber(number);
        
        if(!isRegisteredNumber) {
            return res.status(422).json({
                status: false,
                message: 'The number is not registered'
            });
        }

        client.sendMessage(number, message).then(response => {
            console.error('200 ',response);
            res.status(200).json({
                status: true,
                response: response
            });
        }).catch(err => {
            console.error('500 ',err);
            res.status(500).json({
                status: false,
                response: err
            });
        });
    }
);

server.listen(8010, function() {
    console.log('App running on *: 8010');
});
