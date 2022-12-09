import { rgb2hsv } from "./lib.js";
import { HID, devices as HIDDevices } from 'node-hid';
import commandLineArgs from 'command-line-args';
var devices = HIDDevices();
// const exec = require('child_process').exec;
import { exec } from 'child_process';
// const fs = require('fs');
import fs from 'fs';
import { createInterface } from 'readline';
const rl = createInterface({
    input: process.stdin,
    output: process.stdout
});
var device = devices.find((e) => {
    // Custom usage 0x69 and standard usagePage 0xFF60
    return e.usagePage == 65376 && e.usage == 97;
});
console.log(device);
var keys = new HID(device.path);
function HIDWrite(dev, msg) {
    // divisor for packet size is actual packet size(32bytes) - header size(4bytes) = 28bytes
    const div = 28;
    const packageamt = Math.ceil(msg.length / div);
    console.log("total: ", packageamt);
    let curpack = 1;
    let msgs = [[]];
    for (let n = 0; n < packageamt; n++) {
        let msgnew = [];
        if (n == 0) {
            msgnew = msg.slice((n * div), (div) + (div * n));
            console.log("s: ", n * div, "e: ", (div) + (div * n));
        }
        else {
            msgnew = msg.slice((n * div), (n * div) + (div * n));
            console.log("s: ", n * div, "e: ", (n * div) + (div * n));
        }
        // console.log("msgnew: ", msgnew);
        msgs[n] = [0x00, n + 1, packageamt, 0, ...msgnew];
        msgs[n][3] = msgs[n].length - 1;
    }
    for (let i = 0; i < msgs.length; i++) {
        let write = msgs[i];
        console.log("write ", write.length, ": ", curpack, write);
        dev.write(write);
        curpack = curpack + 1;
    }
}
// Actual messages sent to the HID device
// Format is like this:
// [0x00, reqtype, command, data1, data2, data3]
let actions = {
    "layer_on": (lay) => {
        lay = (lay & 0xFF);
        const write = [0, 1, lay];
        // console.log("hid write: ", write.toString());
        HIDWrite(keys, write);
    },
    "layer_off": (lay) => {
        lay = (lay & 0xFF);
        const write = [0, 0, lay];
        // console.log("hid write: ", write.toString());
        HIDWrite(keys, write);
    },
    "rgb_change": (r, g, b) => {
        let hsv = rgb2hsv(r / 255, g / 255, b / 255);
        let h = (hsv[0] / 360) * 255;
        let s = hsv[1] * 255, v = hsv[2] * 255;
        h = (h & 0xFF);
        s = (s & 0xFF);
        v = (v & 0xFF);
        const write = [1, 0, h, s, v];
        // console.log("hid write: ", write.toString());
        HIDWrite(keys, write);
    },
    "rgb_all": (r, g, b) => {
        r = (r & 0xFF);
        g = (g & 0xFF);
        b = (b & 0xFF);
        const write = [1, 3, r, g, b];
        // console.log("hid write: ", write.toString());
        HIDWrite(keys, write);
    },
    "rgb_ind": (r, g, b, i) => {
        r = (r & 0xFF);
        g = (g & 0xFF);
        b = (b & 0xFF);
        const write = [1, 1, r, g, b];
        for (let n = 0; n < i.length; n++) {
            write.push(i[n] & 0xFF);
        }
        // console.log("hid write: ", write.toString());
        HIDWrite(keys, write);
    },
    "rgb_notify": (r, g, b) => {
        let hsv = rgb2hsv(r / 255, g / 255, b / 255);
        let h = (hsv[0] / 360) * 255;
        let s = hsv[1] * 255, v = hsv[2] * 255;
        h = (h & 0xFF);
        s = (s & 0xFF);
        v = (v & 0xFF);
        const write = [1, 2, h, s, v];
        // console.log("hid write: ", write.toString());
        HIDWrite(keys, write);
        let oldhsv = keys.readSync().splice(0, 3);
        console.log(oldhsv);
        setTimeout(() => {
            const write = [1, 0, oldhsv[0], oldhsv[1], oldhsv[2]];
            // console.log("hid write: ", write.toString());
            HIDWrite(keys, write);
        }, 1000);
    },
    "msg_send": (msg) => {
        const write = [2, 0, 0, 0, 0];
        for (let char = 0; char < msg.length; char++) {
            write.push(msg.charCodeAt(char));
        }
        // console.log("hid write: ", write.toString());
        HIDWrite(keys, write);
    },
    "bootloader": () => {
        const write = [99, 0];
        console.log('bootloader');
        HIDWrite(keys, write);
    }
};
function IR(p, cb) {
    let platform = process.platform;
    let cmd = '';
    switch (platform) {
        case 'win32':
            cmd = `tasklist`;
            break;
        case 'darwin':
            cmd = `ps -ax | grep ${p}`;
            break;
        case 'linux':
            cmd = `ps -A`;
            break;
        default: break;
    }
    exec(cmd, (err, stdout, stderr) => {
        cb(stdout.toLowerCase().indexOf(p.toLowerCase()) > -1);
    });
}
let layerops = ["layer_on", "layer_off", "layer_switch", "layer_on_con"];
// Functions that return custom versions of 'Operation' for different purposes
let ops = {
    // If a process was specified then wait till it is on to turn the layer on
    // Otherwise just turn the layer on
    "layer_on": () => ({
        cb(status) {
            console.log(this);
            if (status == true) {
                setTimeout(() => { actions["layer_on"](this.params.layer); }, this.params.delay);
                if (this.timer) {
                    clearInterval(this.timer);
                }
            }
            else if (status == undefined) {
                console.log("layeronce");
                actions["layer_on"](this.params.layer);
            }
        },
        isRunning() {
            IR(this.params.process, this.cb.bind(this));
        },
        success: false
    }),
    // Wait to turn the layer on until the application is discovered
    // Then stay active and wait until the application is closed and launched again
    "layer_on_con": () => ({
        cb(status) {
            if (status == true && !this.success) {
                setTimeout(() => { actions["layer_on"](this.params.layer); }, this.params.delay);
                this.success = true;
            }
            else if (status == false && this.success) {
                this.success = false;
            }
            else if (status == undefined) {
                throw ("Cannot con without process specified");
            }
        },
        isRunning() {
            IR(this.params.process, this.cb.bind(this));
        },
        success: false
    }),
    // If a process was specified then wait till it is on to turn the layer off
    // Otherwise just turn the layer off
    "layer_off": () => ({
        cb(status) {
            if (status == true) {
                setTimeout(() => { actions["layer_off"](this.params.layer); }, this.params.delay);
                if (this.timer) {
                    clearInterval(this.timer);
                }
            }
            else if (status == undefined) {
                setTimeout(() => { actions["layer_off"](this.params.layer); }, this.params.delay);
            }
        },
        isRunning() {
            IR(this.params.process, this.cb.bind(this));
        },
        success: false
    }),
    // Wait till application is discovered then turn layer on
    // when application is closed then turn the layer off
    // then wait till it is launched again
    "layer_switch": () => ({
        cb(status) {
            if (status == true && !this.success) {
                setTimeout(() => { actions["layer_on"](this.params.layer); }, this.params.delay);
                this.success = true;
            }
            else if (status == false && this.success) {
                setTimeout(() => { actions["layer_off"](this.params.layer); }, this.params.delay);
                this.success = false;
            }
            else if (status == undefined) {
                throw ("Cannot switch without process specified");
            }
        },
        isRunning() {
            IR(this.params.process, this.cb.bind(this));
        },
        success: false
    }),
    "rgb_change": () => ({
        cb(status) {
            if ((status == true || status == undefined) && this.params.rgb && !this.success) {
                const rgb = this.params.rgb.split(',');
                const [r, g, b] = rgb;
                setTimeout(() => { actions["rgb_change"](+r, +g, +b); }, this.params.delay);
                this.success = true;
                clearInterval(this.timer);
            }
            else if (!this.params.rgb) {
                throw ('Need to specify RGB parameter');
            }
        },
        isRunning() {
            IR(this.params.process, this.cb.bind(this));
        },
        success: false
    }),
    "rgb_all": () => ({
        cb(status) {
            if ((status == true || status == undefined) && this.params.rgb && !this.success) {
                const rgb = this.params.rgb.split(',');
                const [r, g, b] = rgb;
                setTimeout(() => { actions["rgb_all"](+r, +g, +b); }, this.params.delay);
                this.success = true;
                clearInterval(this.timer);
            }
            else if (!this.params.rgb) {
                throw ('Need to specify RGB parameter');
            }
        },
        isRunning() {
            IR(this.params.process, this.cb.bind(this));
        },
        success: false
    }),
    "rgb_ind": () => ({
        cb(status) {
            if ((status == true || status == undefined) && this.params.rgb && !this.success) {
                const rgbi = this.params.rgb.split(',');
                let [r, g, b, ...i] = rgbi;
                i = i.map((e) => {
                    return +e;
                });
                console.log(i);
                setTimeout(() => { actions["rgb_ind"](+r, +g, +b, i); }, this.params.delay);
                this.success = true;
                clearInterval(this.timer);
            }
            else if (!this.params.rgb) {
                throw ('Need to specify RGB parameter');
            }
        },
        isRunning() {
            IR(this.params.process, this.cb.bind(this));
        },
        success: false
    }),
    "rgb_notify": () => ({
        cb(status) {
            if ((status == true || status == undefined) && this.params.rgb && !this.success) {
                const rgb = this.params.rgb.split(',');
                const [r, g, b] = rgb;
                setTimeout(() => { actions["rgb_notify"](+r, +g, +b); }, this.params.delay);
                this.success = true;
                clearInterval(this.timer);
            }
            else if (!this.params.rgb) {
                throw ('Need to specify RGB parameter');
            }
        },
        isRunning() {
            IR(this.params.process, this.cb.bind(this));
        },
        success: false
    }),
    "msg_send": () => ({
        cb(status) {
            if ((status == true || status == undefined) && this.params.msg && !this.success) {
                setTimeout(() => { actions["msg_send"](this.params.msg); }, this.params.delay);
                this.success = true;
                clearInterval(this.timer);
            }
            else if (!this.params.msg) {
                throw ('Need to specify message parameter');
            }
        },
        isRunning() {
            IR(this.params.process, this.cb.bind(this));
        },
        success: false
    }),
    "bootloader": () => ({
        cb(status) {
            if (status == true || status == undefined) {
                setTimeout(() => { actions["bootloader"](); }, this.params.delay);
            }
        },
        isRunning() {
            IR(this.params.process, this.cb.bind(this));
        },
        success: false
    })
};
let act = (action, params, index) => {
    try {
        let op = ops[action]();
        op.params = params; // { layer: undefined, process: undefined, rgb: undefined, msg: undefined, delay: 0 }
        if (op.params.layer) {
            console.log('layer: ', op.params.layer);
        }
        else {
            if (layerops.indexOf(action) != -1) {
                throw ('A layer must be specified');
            }
        }
        if (op.params.rgb) {
            console.log('rgb: ', op.params.rgb);
        }
        else {
            if (action == "rgb_change") {
                throw ('Need to specify RGB parameter');
            }
        }
        if (op.params.msg) {
            console.log('msg: ', op.params.msg);
        }
        else {
            if (action == "msg_send") {
                throw ('Need to specify message parameter');
            }
        }
        if (op.params.delay) {
            console.log('del: ', op.params.delay);
        }
        if (op.params.process) {
            let time = 3000 + (250 * index);
            op.timer = setInterval(() => op.isRunning(), time);
        }
        else {
            let time = 0 + (115 * index);
            console.log('else');
            setTimeout(op.cb.bind(op), time);
        }
        return op;
    }
    catch (err) {
        throw (err);
    }
};
let actinit = function (opArgs) {
    for (const i in opArgs) {
        let argos = opArgs[i];
        // if we are using the command line to exec actions
        const actionDefinitions = [
            { name: 'action', type: String, defaultOption: true }
        ];
        secondaryOptions[i] = commandLineArgs(actionDefinitions, { argv: argos, stopAtFirstUnknown: true });
        const actoptsunk = secondaryOptions[i]._unknown || [];
        let execDefinitions = [];
        let execOptions;
        execDefinitions = [
            { name: 'rgb', alias: 'r', type: String },
            { name: 'msg', alias: 'm', type: String },
            { name: 'process', alias: 'p', type: String },
            { name: 'delay', alias: 'd', type: Number },
            { name: 'layer', alias: 'l', type: Number },
        ];
        execOptions = commandLineArgs(execDefinitions, { argv: actoptsunk });
        let reqargs = [];
        switch (secondaryOptions[i].action) {
            case 'layer_on':
                reqargs = ['layer'];
                break;
            case 'layer_on_con':
                reqargs = ['layer', 'process'];
                break;
            case 'layer_off':
                reqargs = ['layer'];
                break;
            case 'layer_switch':
                reqargs = ['layer', 'process'];
                break;
            case 'rgb_change':
                reqargs = ['rgb'];
                break;
            case 'rgb_all':
                reqargs = ['rgb'];
                break;
            case 'rgb_ind':
                reqargs = ['rgb'];
                break;
            case 'rgb_notify':
                reqargs = ['rgb'];
                break;
            case 'msg_send':
                reqargs = ['msg'];
                break;
            case 'bootloader':
                reqargs = [];
                break;
        }
        for (let r in reqargs) {
            if (!execOptions[reqargs[r]]) {
                throw `${reqargs[r]} is undefined, but required`;
            }
        }
        act(secondaryOptions[i].action, execOptions, +i);
        console.log(`\secondaryOptions[${i}]\n============`);
        console.log(secondaryOptions[i]);
    }
};
// node app.js exec -p msgtest1.json
// node app.js --op -r audiorelay.exe -a layer_on_con -l 1
let argvs = process.argv.splice(2, process.argv.length);
console.log(argvs);
let commandOptions;
let secondaryOptions = [];
const commandDefinitions = [
    { name: 'command', type: String, defaultOption: true }
];
commandOptions = commandLineArgs(commandDefinitions, { stopAtFirstUnknown: true, argv: argvs });
const params = commandOptions._unknown || [];
console.log(`\ncommandOptions\n============`);
console.log(commandOptions);
// second - parse the config command options
if (commandOptions.command === 'config') {
    const configDefinitions = [
        { name: 'path', alias: 'p', type: String }
    ];
    secondaryOptions[0] = commandLineArgs(configDefinitions, { argv: params });
    console.log(`\nsecondaryOptions[${0}]\n============`);
    console.log(secondaryOptions[0]);
    fs.readFile(secondaryOptions[0].path, function (err, data) {
        if (err) {
            throw err;
        }
        const conf = JSON.parse(data).operations;
        for (let op in conf) {
            const curop = conf[op];
            for (let ac in curop.actions) {
                let curobj = curop.actions[ac];
                curobj.process = curop.process;
                console.log(`curobj: ${JSON.stringify(curobj)}`);
                curobj.action = act(curobj.action, curobj, +ac);
            }
        }
    });
}
else if (commandOptions.command === 'exec') {
    let opArgs = [];
    params.forEach((e, i, a) => {
        if (e === '--op') {
            opArgs.push(a.slice(i + 1, a.slice(i + 1, a.length).indexOf('--op') + 1 || a.length));
        }
    });
    console.log('opArgs ');
    console.log(opArgs);
    actinit(opArgs);
}
else if (commandOptions.command === 'cli') {
    rl.setPrompt('cmd> ');
    rl.prompt();
    rl.on('line', function (cmd) {
        if (cmd == 'exit') {
            rl.close();
        }
        else {
            let params = cmd.split(' ');
            let opArgs = [];
            params.forEach((e, i, a) => {
                if (e === '--op') {
                    opArgs.push(a.slice(i + 1, a.slice(i + 1, a.length).indexOf('--op') + 1 || a.length));
                }
            });
            console.log('opArgs ');
            console.log(opArgs);
            actinit(opArgs);
        }
        rl.prompt();
    }).on('close', function () {
        console.log('Have a great day!');
        process.exit(0);
    });
}
//# sourceMappingURL=app.js.map