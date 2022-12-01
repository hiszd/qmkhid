"use strict";
exports.__esModule = true;
var lib_1 = require("./lib");
var HID = require('node-hid');
var devices = HID.devices();
var exec = require('child_process').exec;
var fs = require('fs');
var device = devices.find(function (e) {
    return e.vendorId == 43670 && e.productId == 43689 && e.usagePage == 65424 && e.usage == 105;
});
var keys = new HID.HID(device.path);
// Actual messages sent to the HID device
// Format is like this:
// [0x00, reqtype, command, data1, data2, data3]
var actions = {
    "layer_on": function (lay) {
        lay = (lay & 0xFF);
        var write = [0x00, 0, 1, 5, lay];
        console.log("hid write: ", write.toString());
        keys.write(write);
    },
    "layer_off": function (lay) {
        lay = (lay & 0xFF);
        var write = [0x00, 0, 0, 5, lay];
        console.log("hid write: ", write.toString());
        keys.write(write);
    },
    "rgb_change": function (r, g, b) {
        var hsv = (0, lib_1.rgb2hsv)(r / 255, g / 255, b / 255);
        var h = (hsv[0] / 360) * 255;
        var s = hsv[1] * 255, v = hsv[2] * 255;
        h = (h & 0xFF);
        s = (s & 0xFF);
        v = (v & 0xFF);
        var write = [0x00, 1, 0, 7, h, s, v];
        console.log("hid write: ", write.toString());
        keys.write(write);
    },
    "rgb_all": function (r, g, b) {
        r = (r & 0xFF);
        g = (g & 0xFF);
        b = (b & 0xFF);
        var write = [0x00, 1, 3, 7, r, g, b];
        console.log("hid write: ", write.toString());
        keys.write(write);
    },
    "rgb_ind": function (r, g, b, i) {
        r = (r & 0xFF);
        g = (g & 0xFF);
        b = (b & 0xFF);
        var write = [0x00, 1, 1, (7 + i.length), r, g, b];
        for (var n = 0; n < i.length; n++) {
            write.push(i[n] & 0xFF);
        }
        console.log("hid write: ", write.toString());
        keys.write(write);
    },
    "rgb_notify": function (r, g, b) {
        var hsv = (0, lib_1.rgb2hsv)(r / 255, g / 255, b / 255);
        var h = (hsv[0] / 360) * 255;
        var s = hsv[1] * 255, v = hsv[2] * 255;
        h = (h & 0xFF);
        s = (s & 0xFF);
        v = (v & 0xFF);
        var write = [0x00, 1, 2, 7, h, s, v];
        console.log("hid write: ", write.toString());
        keys.write(write);
        var oldhsv = keys.readSync().splice(0, 3);
        console.log(oldhsv);
        setTimeout(function () {
            var write = [0x00, 1, 0, 7, oldhsv[0], oldhsv[1], oldhsv[2]];
            console.log("hid write: ", write.toString());
            keys.write(write);
        }, 1000);
    },
    "msg_send": function (msg) {
        var write = [0x00, 2, 0, (3 + msg.length), 0, 0, 0];
        for (var char = 0; char < msg.length; char++) {
            write.push(msg.charCodeAt(char));
        }
        console.log("hid write: ", write.toString());
        keys.write(write);
    },
    "bootloader": function () {
        var write = [0x00, 99, 0, 7];
        console.log('bootloader');
        keys.write(write);
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
            console.log(this);
            if (status == true) {
                actions["layer_on"](this.params.layer);
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
            if (status == true && !this.success) {
                actions["layer_on"](this.params.layer);
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
            if (status == true) {
                actions["layer_off"](this.params.layer);
                if (this.timer) {
                    clearInterval(this.timer);
                }
            }
            else if (status == undefined) {
                actions["layer_off"](this.params.layer);
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
            if (status == true && !this.success) {
                actions["layer_on"](this.params.layer);
                this.success = true;
            }
            else if (status == false && this.success) {
                actions["layer_off"](this.params.layer);
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
                var r = rgb[0], g = rgb[1], b = rgb[2];
                actions["rgb_change"](+r, +g, +b);
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
                var r = rgb[0], g = rgb[1], b = rgb[2];
                actions["rgb_all"](+r, +g, +b);
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
                var r = rgbi[0], g = rgbi[1], b = rgbi[2], i = rgbi.slice(3);
                i = i.map(function (e) {
                    return +e;
                });
                console.log(i);
                actions["rgb_ind"](+r, +g, +b, i);
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
                var r = rgb[0], g = rgb[1], b = rgb[2];
                actions["rgb_notify"](+r, +g, +b);
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
            if ((status == true || status == undefined) && this.params.msg && !this.success) {
                actions["msg_send"](this.params.msg);
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
                actions["bootloader"]();
            }
        },
        isRunning: function () {
            IR(this.params.process, this.cb.bind(this));
        },
        success: false
    }); }
};
var act = function (action) {
    try {
        var op = ops[action]();
        op.params = { layer: undefined, process: undefined, rgb: undefined, msg: undefined };
        return op;
    }
    catch (err) {
        throw (err);
    }
};
var Action = {
    action: '',
    layer: null,
    rgb: '',
    process: '',
    op: {}
};
var Args = {
    process: '',
    actions: []
};
var args = [];
// node app.js --op -r audiorelay.exe -a layer_on_con -l 1
var argv = process.argv.splice(2, process.argv.length).join(' ');
var argg = argv.split(' ');
for (var arg in argg) {
    if (argg[arg] == '-c') {
        fs.readFile(argg[+arg + 1], function (err, data) {
            var conf = JSON.parse(data).operations;
            for (var op in conf) {
                var curop = conf[op];
                var obj = Args;
                var _loop_1 = function (ac) {
                    var curac = curop.actions[ac].action;
                    var curlay = curop.actions[ac].layer;
                    var currgb = curop.actions[ac].rgb;
                    var curmsg = curop.actions[ac].msg;
                    var curact = act(curac);
                    if (curlay) {
                        console.log('layer: ', curlay);
                        curact.params.layer = curlay;
                    }
                    else {
                        if (layerops.indexOf(curac) != -1) {
                            throw ('A layer must be specified');
                        }
                    }
                    if (currgb) {
                        console.log('rgb: ', currgb);
                        curact.params.rgb = currgb;
                    }
                    else {
                        if (curac == "rgb_change") {
                            throw ('Need to specify RGB parameter');
                        }
                    }
                    if (curmsg) {
                        console.log('msg: ', curmsg);
                        curact.params.msg = curmsg;
                    }
                    else {
                        if (curac == "msg_send") {
                            throw ('Need to specify message parameter');
                        }
                    }
                    if (curop.process) {
                        curact.params.process = curop.process;
                        var time = 3000 + (250 * +ac);
                        curact.timer = setInterval(function () { return curact.isRunning(); }, time);
                    }
                    else {
                        var time = 0 + (250 * +ac);
                        console.log('else');
                        setTimeout(curact.cb.bind(curact), time);
                    }
                };
                for (var ac in curop.actions) {
                    _loop_1(ac);
                }
            }
        });
    }
}
/*

let argvstart = argv.indexOf("--op");
let argvpost = argv.trimStart().split('--op ').slice(argvstart, argv.length);
argvpost = argvpost.splice(1, argvpost.length);
for (let arg in argvpost) {
  const obj = Args;
  let argarr = argvpost[arg].split(' ');
  for (let a in argarr) {
    switch (argarr[a]) {
      case '-r':
        obj.process = argarr[+a + 1];
        break;
      case '-a':
        obj.actions.push(argarr[+a + 1]);
        break;
      case '-l':
        obj.layers.push(+argarr[+a + 1]);
        break;
      case '-rgb':
        obj.rgbs.push(argarr[+a + 1]);
        break;
    }
  }

  for (let ac in obj.actions) {
    const curac: string = obj.actions[ac];
    const curlay: number = obj.layers[ac];
    const currgb: string = obj.rgbs[ac];
    obj.acts[ac] = act(curac);
    const curact = obj.acts[ac];

    if (curlay) {
      console.log('layer: ', curlay);
      curact.params.layer = curlay;
    } else {
      if (curac != "bootloader" && curac != "rgb_change") {
        throw ('A layer must be specified');
      }
    }

    if (currgb) {
      console.log('rgb: ', currgb);
      curact.params.rgb = currgb;
    } else {
      if (curac == "rgb_change") {
        throw ('Need to specify RGB parameter');
      }
    }

    if (obj.process) {
      curact.params.process = obj.process;
      curact.timer = setInterval(() => curact.isRunning(), 3000);
    } else {
      console.log('else');
      curact.cb();
    }

  }
  console.log(obj);
  args.push(obj);
}

*/
// let readProc: "rgb_notify" | "";
// let resetHSV: string;
//
// keys.on("data", function(data) {
//   if (readProc) {
//     switch (readProc) {
//       case "rgb_notify":
//         let [h, s, v] = resetHSV.split(',');
//         return;
//       default:
//         return;
//     }
//   }
// });
