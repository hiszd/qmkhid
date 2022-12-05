"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
exports.__esModule = true;
var lib_1 = require("./lib");
var node_hid_1 = require("node-hid");
var commandLineArgs = require("command-line-args");
var devices = (0, node_hid_1.devices)();
var exec = require('child_process').exec;
var fs = require('fs');
var device = devices.find(function (e) {
    // Custom usage 0x69 and standard usagePage 0xFF60
    return e.usagePage == 65376 && e.usage == 97;
});
var keys = new node_hid_1.HID(device.path);
function HIDWrite(dev, msg) {
    var div = 29;
    var packageamt = Math.ceil(msg.length / div);
    console.log("total: ", packageamt);
    var curpack = 1;
    var msgs = [[]];
    for (var n = 0; n < packageamt; n++) {
        var msgnew = [];
        if (n == 0) {
            msgnew = msg.slice((n * div), (div) + (div * n));
            console.log("s: ", n * div, "e: ", (div) + (div * n));
        }
        else {
            msgnew = msg.slice((n * div), (n * div) + (div * n));
            console.log("s: ", n * div, "e: ", (n * div) + (div * n));
        }
        console.log("msgnew: ", msgnew);
        msgs[n] = __spreadArray([n + 1, packageamt, 0], msgnew, true);
        msgs[n][2] = msgs[n].length;
    }
    for (var i = 0; i < msgs.length; i++) {
        var write = msgs[i];
        console.log("write ", write.length, ": ", curpack, write);
        dev.write(write);
        curpack = curpack + 1;
    }
}
// Actual messages sent to the HID device
// Format is like this:
// [0x00, reqtype, command, data1, data2, data3]
var actions = {
    "layer_on": function (lay) {
        lay = (lay & 0xFF);
        var write = [0x00, 0, 1, lay];
        // console.log("hid write: ", write.toString());
        HIDWrite(keys, write);
    },
    "layer_off": function (lay) {
        lay = (lay & 0xFF);
        var write = [0x00, 0, 0, lay];
        // console.log("hid write: ", write.toString());
        HIDWrite(keys, write);
    },
    "rgb_change": function (r, g, b) {
        var hsv = (0, lib_1.rgb2hsv)(r / 255, g / 255, b / 255);
        var h = (hsv[0] / 360) * 255;
        var s = hsv[1] * 255, v = hsv[2] * 255;
        h = (h & 0xFF);
        s = (s & 0xFF);
        v = (v & 0xFF);
        var write = [0x00, 1, 0, h, s, v];
        // console.log("hid write: ", write.toString());
        HIDWrite(keys, write);
    },
    "rgb_all": function (r, g, b) {
        r = (r & 0xFF);
        g = (g & 0xFF);
        b = (b & 0xFF);
        var write = [0x00, 1, 3, r, g, b];
        // console.log("hid write: ", write.toString());
        HIDWrite(keys, write);
    },
    "rgb_ind": function (r, g, b, i) {
        r = (r & 0xFF);
        g = (g & 0xFF);
        b = (b & 0xFF);
        var write = [0x00, 1, 1, r, g, b];
        for (var n = 0; n < i.length; n++) {
            write.push(i[n] & 0xFF);
        }
        // console.log("hid write: ", write.toString());
        HIDWrite(keys, write);
    },
    "rgb_notify": function (r, g, b) {
        var hsv = (0, lib_1.rgb2hsv)(r / 255, g / 255, b / 255);
        var h = (hsv[0] / 360) * 255;
        var s = hsv[1] * 255, v = hsv[2] * 255;
        h = (h & 0xFF);
        s = (s & 0xFF);
        v = (v & 0xFF);
        var write = [0x00, 1, 2, h, s, v];
        console.log("hid write: ", write.toString());
        HIDWrite(keys, write);
        var oldhsv = keys.readSync().splice(0, 3);
        console.log(oldhsv);
        setTimeout(function () {
            var write = [0x00, 1, 0, oldhsv[0], oldhsv[1], oldhsv[2]];
            console.log("hid write: ", write.toString());
            HIDWrite(keys, write);
        }, 1000);
    },
    "msg_send": function (msg) {
        var write = [0x00, 2, 0, 0, 0, 0];
        for (var char = 0; char < msg.length; char++) {
            write.push(msg.charCodeAt(char));
        }
        console.log("hid write: ", write.toString());
        HIDWrite(keys, write);
    },
    "bootloader": function () {
        var write = [0x00, 99, 0];
        console.log('bootloader');
        HIDWrite(keys, write);
    }
};
function IR(p, cb) {
    var platform = process.platform;
    var cmd = '';
    switch (platform) {
        case 'win32':
            cmd = "tasklist";
            break;
        case 'darwin':
            cmd = "ps -ax | grep ".concat(p);
            break;
        case 'linux':
            cmd = "ps -A";
            break;
        default: break;
    }
    exec(cmd, function (err, stdout, stderr) {
        cb(stdout.toLowerCase().indexOf(p.toLowerCase()) > -1);
    });
}
var layerops = ["layer_on", "layer_off", "layer_switch", "layer_on_con"];
// Functions that return custom versions of 'Operation' for different purposes
var ops = {
    // If a process was specified then wait till it is on to turn the layer on
    // Otherwise just turn the layer on
    "layer_on": function () { return ({
        cb: function (status) {
            var _this = this;
            console.log(this);
            if (status == true) {
                setTimeout(function () { actions["layer_on"](_this.params.layer); }, this.params.delay);
                if (this.timer) {
                    clearInterval(this.timer);
                }
            }
            else if (status == undefined) {
                console.log("layeronce");
                actions["layer_on"](this.params.layer);
            }
        },
        isRunning: function () {
            IR(this.params.process, this.cb.bind(this));
        },
        success: false
    }); },
    // Wait to turn the layer on until the application is discovered
    // Then stay active and wait until the application is closed and launched again
    "layer_on_con": function () { return ({
        cb: function (status) {
            var _this = this;
            if (status == true && !this.success) {
                setTimeout(function () { actions["layer_on"](_this.params.layer); }, this.params.delay);
                this.success = true;
            }
            else if (status == false && this.success) {
                this.success = false;
            }
            else if (status == undefined) {
                throw ("Cannot con without process specified");
            }
        },
        isRunning: function () {
            IR(this.params.process, this.cb.bind(this));
        },
        success: false
    }); },
    // If a process was specified then wait till it is on to turn the layer off
    // Otherwise just turn the layer off
    "layer_off": function () { return ({
        cb: function (status) {
            var _this = this;
            if (status == true) {
                setTimeout(function () { actions["layer_off"](_this.params.layer); }, this.params.delay);
                if (this.timer) {
                    clearInterval(this.timer);
                }
            }
            else if (status == undefined) {
                setTimeout(function () { actions["layer_off"](_this.params.layer); }, this.params.delay);
            }
        },
        isRunning: function () {
            IR(this.params.process, this.cb.bind(this));
        },
        success: false
    }); },
    // Wait till application is discovered then turn layer on
    // when application is closed then turn the layer off
    // then wait till it is launched again
    "layer_switch": function () { return ({
        cb: function (status) {
            var _this = this;
            if (status == true && !this.success) {
                setTimeout(function () { actions["layer_on"](_this.params.layer); }, this.params.delay);
                this.success = true;
            }
            else if (status == false && this.success) {
                setTimeout(function () { actions["layer_off"](_this.params.layer); }, this.params.delay);
                this.success = false;
            }
            else if (status == undefined) {
                throw ("Cannot switch without process specified");
            }
        },
        isRunning: function () {
            IR(this.params.process, this.cb.bind(this));
        },
        success: false
    }); },
    "rgb_change": function () { return ({
        cb: function (status) {
            if ((status == true || status == undefined) && this.params.rgb && !this.success) {
                var rgb = this.params.rgb.split(',');
                var r_1 = rgb[0], g_1 = rgb[1], b_1 = rgb[2];
                setTimeout(function () { actions["rgb_change"](+r_1, +g_1, +b_1); }, this.params.delay);
                this.success = true;
                clearInterval(this.timer);
            }
            else if (!this.params.rgb) {
                throw ('Need to specify RGB parameter');
            }
        },
        isRunning: function () {
            IR(this.params.process, this.cb.bind(this));
        },
        success: false
    }); },
    "rgb_all": function () { return ({
        cb: function (status) {
            if ((status == true || status == undefined) && this.params.rgb && !this.success) {
                var rgb = this.params.rgb.split(',');
                var r_2 = rgb[0], g_2 = rgb[1], b_2 = rgb[2];
                setTimeout(function () { actions["rgb_all"](+r_2, +g_2, +b_2); }, this.params.delay);
                this.success = true;
                clearInterval(this.timer);
            }
            else if (!this.params.rgb) {
                throw ('Need to specify RGB parameter');
            }
        },
        isRunning: function () {
            IR(this.params.process, this.cb.bind(this));
        },
        success: false
    }); },
    "rgb_ind": function () { return ({
        cb: function (status) {
            if ((status == true || status == undefined) && this.params.rgb && !this.success) {
                var rgbi = this.params.rgb.split(',');
                var r_3 = rgbi[0], g_3 = rgbi[1], b_3 = rgbi[2], i_1 = rgbi.slice(3);
                i_1 = i_1.map(function (e) {
                    return +e;
                });
                console.log(i_1);
                setTimeout(function () { actions["rgb_ind"](+r_3, +g_3, +b_3, i_1); }, this.params.delay);
                this.success = true;
                clearInterval(this.timer);
            }
            else if (!this.params.rgb) {
                throw ('Need to specify RGB parameter');
            }
        },
        isRunning: function () {
            IR(this.params.process, this.cb.bind(this));
        },
        success: false
    }); },
    "rgb_notify": function () { return ({
        cb: function (status) {
            if ((status == true || status == undefined) && this.params.rgb && !this.success) {
                var rgb = this.params.rgb.split(',');
                var r_4 = rgb[0], g_4 = rgb[1], b_4 = rgb[2];
                setTimeout(function () { actions["rgb_notify"](+r_4, +g_4, +b_4); }, this.params.delay);
                this.success = true;
                clearInterval(this.timer);
            }
            else if (!this.params.rgb) {
                throw ('Need to specify RGB parameter');
            }
        },
        isRunning: function () {
            IR(this.params.process, this.cb.bind(this));
        },
        success: false
    }); },
    "msg_send": function () { return ({
        cb: function (status) {
            var _this = this;
            if ((status == true || status == undefined) && this.params.msg && !this.success) {
                setTimeout(function () { actions["msg_send"](_this.params.msg); }, this.params.delay);
                this.success = true;
                clearInterval(this.timer);
            }
            else if (!this.params.msg) {
                throw ('Need to specify message parameter');
            }
        },
        isRunning: function () {
            IR(this.params.process, this.cb.bind(this));
        },
        success: false
    }); },
    "bootloader": function () { return ({
        cb: function (status) {
            if (status == true || status == undefined) {
                setTimeout(function () { actions["bootloader"](); }, this.params.delay);
            }
        },
        isRunning: function () {
            IR(this.params.process, this.cb.bind(this));
        },
        success: false
    }); }
};
var act = function (action, params, index) {
    try {
        var op_1 = ops[action]();
        op_1.params = params; // { layer: undefined, process: undefined, rgb: undefined, msg: undefined, delay: 0 }
        if (op_1.params.layer) {
            console.log('layer: ', op_1.params.layer);
        }
        else {
            if (layerops.indexOf(action) != -1) {
                throw ('A layer must be specified');
            }
        }
        if (op_1.params.rgb) {
            console.log('rgb: ', op_1.params.rgb);
        }
        else {
            if (action == "rgb_change") {
                throw ('Need to specify RGB parameter');
            }
        }
        if (op_1.params.msg) {
            console.log('msg: ', op_1.params.msg);
        }
        else {
            if (action == "msg_send") {
                throw ('Need to specify message parameter');
            }
        }
        if (op_1.params.delay) {
            console.log('del: ', op_1.params.delay);
        }
        if (op_1.params.process) {
            var time = 3000 + (250 * index);
            op_1.timer = setInterval(function () { return op_1.isRunning(); }, time);
        }
        else {
            var time = 0 + (115 * index);
            console.log('else');
            setTimeout(op_1.cb.bind(op_1), time);
        }
        return op_1;
    }
    catch (err) {
        throw (err);
    }
};
// node app.js exec -p msgtest1.json
// node app.js --op -r audiorelay.exe -a layer_on_con -l 1
var argvs = process.argv.splice(2, process.argv.length);
console.log(argvs);
var commandOptions;
var secondaryOptions = [];
var commandDefinitions = [
    { name: 'command', type: String, defaultOption: true }
];
commandOptions = commandLineArgs(commandDefinitions, { stopAtFirstUnknown: true, argv: argvs });
var params = commandOptions._unknown || [];
console.log("\ncommandOptions\n============");
console.log(commandOptions);
// second - parse the config command options
if (commandOptions.command === 'config') {
    var configDefinitions = [
        { name: 'path', alias: 'p', type: String }
    ];
    secondaryOptions[0] = commandLineArgs(configDefinitions, { argv: params });
    console.log("\nsecondaryOptions[".concat(0, "]\n============"));
    console.log(secondaryOptions[0]);
    fs.readFile(secondaryOptions[0].path, function (err, data) {
        if (err) {
            throw err;
        }
        var conf = JSON.parse(data).operations;
        for (var op in conf) {
            var curop = conf[op];
            for (var ac in curop.actions) {
                var curobj = curop.actions[ac];
                curobj.action = act(curobj.action, curop, +ac);
            }
        }
    });
}
else if (commandOptions.command === 'exec') {
    var opArgs_1 = [];
    params.forEach(function (e, i, a) {
        if (e === '--op') {
            opArgs_1.push(a.slice(i + 1, a.slice(i + 1, a.length).indexOf('--op') + 1 || a.length));
        }
    });
    console.log('opArgs ');
    console.log(opArgs_1);
    for (var i in opArgs_1) {
        var argos = opArgs_1[i];
        // if we are using the command line to exec actions
        var actionDefinitions = [
            { name: 'action', type: String, defaultOption: true }
        ];
        secondaryOptions[i] = commandLineArgs(actionDefinitions, { argv: argos, stopAtFirstUnknown: true });
        var actoptsunk = secondaryOptions[i]._unknown || [];
        var execDefinitions = [];
        var execOptions = void 0;
        execDefinitions = [
            { name: 'rgb', alias: 'r', type: String },
            { name: 'msg', alias: 'm', type: String },
            { name: 'process', alias: 'p', type: String },
            { name: 'delay', alias: 'd', type: Number },
            { name: 'layer', alias: 'l', type: Number },
        ];
        execOptions = commandLineArgs(execDefinitions, { argv: actoptsunk });
        var reqargs = [];
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
        for (var r in reqargs) {
            if (!execOptions[reqargs[r]]) {
                throw "".concat(reqargs[r], " is undefined, but required");
            }
        }
        act(secondaryOptions[i].action, execOptions, +i);
        console.log("secondaryOptions[".concat(i, "]\n============"));
        console.log(secondaryOptions[i]);
    }
}
