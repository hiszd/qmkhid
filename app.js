var HID = require('node-hid');
var devices = HID.devices();
var exec = require('child_process').exec;
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
        var write = [0x00, 0, lay, 1];
        console.log("hid write: ", write.toString());
        keys.write(write);
    },
    "layer_off": function (lay) {
        lay = (lay & 0xFF);
        var write = [0x00, 0, lay, 0];
        console.log("hid write: ", write.toString());
        keys.write(write);
    },
    "rgb_change": function (r, g, b, ind) {
        r = (r & 0xFF);
        g = (g & 0xFF);
        b = (b & 0xFF);
        ind = (ind & 0xFF);
        var write = [0x00, 1, 0, r, g, b, ind];
        console.log("hid write: ", write.toString());
        keys.write(write);
    },
    "bootloader": function () {
        var write = [0x00, 99, 0, 0];
        console.log('bootloader');
        keys.write(write);
    }
};
// Functions that return custom versions of 'Operation' for different purposes
var ops = {
    // If a process was specified then wait till it is on to turn the layer on
    // Otherwise just turn the layer on
    "layer_on": function () { return ({
        cb: function (status) {
            if (status == true) {
                actions["layer_on"](this.layer);
                if (this.timer) {
                    clearInterval(this.timer);
                }
            }
            else if (status == undefined) {
                actions["layer_on"](this.layer);
            }
        },
        isRunning: function () {
            var _this = this;
            var platform = process.platform;
            var cmd = '';
            switch (platform) {
                case 'win32':
                    cmd = "tasklist";
                    break;
                case 'darwin':
                    cmd = "ps -ax | grep ".concat(this.process);
                    break;
                case 'linux':
                    cmd = "ps -A";
                    break;
                default: break;
            }
            exec(cmd, function (err, stdout, stderr) {
                _this.cb(stdout.toLowerCase().indexOf(_this.process.toLowerCase()) > -1);
            });
        },
        success: false
    }); },
    // Wait to turn the layer on until the application is discovered
    // Then stay active and wait until the application is closed and launched again
    "layer_on_con": function () { return ({
        cb: function (status) {
            if (status == true && !this.success) {
                actions["layer_on"](this.layer);
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
            var _this = this;
            var platform = process.platform;
            var cmd = '';
            switch (platform) {
                case 'win32':
                    cmd = "tasklist";
                    break;
                case 'darwin':
                    cmd = "ps -ax | grep ".concat(this.process);
                    break;
                case 'linux':
                    cmd = "ps -A";
                    break;
                default: break;
            }
            exec(cmd, function (err, stdout, stderr) {
                _this.cb(stdout.toLowerCase().indexOf(_this.process.toLowerCase()) > -1);
            });
        },
        success: false
    }); },
    // If a process was specified then wait till it is on to turn the layer off
    // Otherwise just turn the layer off
    "layer_off": function () { return ({
        cb: function (status) {
            if (status == true) {
                actions["layer_off"](this.layer);
                if (this.timer) {
                    clearInterval(this.timer);
                }
            }
            else if (status == undefined) {
                actions["layer_off"](this.layer);
            }
        },
        isRunning: function () {
            var _this = this;
            var platform = process.platform;
            var cmd = '';
            switch (platform) {
                case 'win32':
                    cmd = "tasklist";
                    break;
                case 'darwin':
                    cmd = "ps -ax | grep ".concat(this.process);
                    break;
                case 'linux':
                    cmd = "ps -A";
                    break;
                default: break;
            }
            exec(cmd, function (err, stdout, stderr) {
                _this.cb(stdout.toLowerCase().indexOf(_this.process.toLowerCase()) > -1);
            });
        },
        success: false
    }); },
    // Wait till application is discovered then turn layer on
    // when application is closed then turn the layer off
    // then wait till it is launched again
    "layer_switch": function () { return ({
        cb: function (status) {
            if (status == true && !this.success) {
                actions["layer_on"](this.layer);
                this.success = true;
            }
            else if (status == false && this.success) {
                actions["layer_off"](this.layer);
                this.success = false;
            }
            else if (status == undefined) {
                throw ("Cannot switch without process specified");
            }
        },
        isRunning: function () {
            var _this = this;
            var platform = process.platform;
            var cmd = '';
            switch (platform) {
                case 'win32':
                    cmd = "tasklist";
                    break;
                case 'darwin':
                    cmd = "ps -ax | grep ".concat(this.process);
                    break;
                case 'linux':
                    cmd = "ps -A";
                    break;
                default: break;
            }
            exec(cmd, function (err, stdout, stderr) {
                _this.cb(stdout.toLowerCase().indexOf(_this.process.toLowerCase()) > -1);
            });
        },
        success: false
    }); },
    "rgb_change": function () { return ({
        cb: function (status) {
            if (status == true || status == undefined) {
                actions["rgb_change"](255, 0, 0, 1);
            }
        },
        isRunning: function () {
            var _this = this;
            var platform = process.platform;
            var cmd = '';
            switch (platform) {
                case 'win32':
                    cmd = "tasklist";
                    break;
                case 'darwin':
                    cmd = "ps -ax | grep ".concat(this.process);
                    break;
                case 'linux':
                    cmd = "ps -A";
                    break;
                default: break;
            }
            exec(cmd, function (err, stdout, stderr) {
                _this.cb(stdout.toLowerCase().indexOf(_this.process.toLowerCase()) > -1);
            });
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
            var _this = this;
            var platform = process.platform;
            var cmd = '';
            switch (platform) {
                case 'win32':
                    cmd = "tasklist";
                    break;
                case 'darwin':
                    cmd = "ps -ax | grep ".concat(this.process);
                    break;
                case 'linux':
                    cmd = "ps -A";
                    break;
                default: break;
            }
            exec(cmd, function (err, stdout, stderr) {
                _this.cb(stdout.toLowerCase().indexOf(_this.process.toLowerCase()) > -1);
            });
        },
        success: false
    }); }
};
var act = function (action, layer) {
    try {
        var op = ops[action]();
        if (layer)
            op.layer = layer;
        return op;
    }
    catch (err) {
        throw (err);
    }
};
;
var args = [];
// node app.js --op -r audiorelay.exe -a layer_on_con -l 1
var argv = process.argv.splice(2, process.argv.length).join(' ');
var argvstart = argv.indexOf("--op");
var argvpost = argv.trimStart().split('--op ').slice(argvstart, argv.length);
argvpost = argvpost.splice(1, argvpost.length);
var _loop_1 = function (arg) {
    var argind = args.length + 1;
    args[argind] = {};
    var argarr = argvpost[arg].split(' ');
    for (var a in argarr) {
        switch (argarr[a]) {
            case '-r':
                args[argind].process = argarr[+a + 1];
                break;
            case '-a':
                args[argind].action = argarr[+a + 1];
                break;
            case '-l':
                args[argind].layer = +argarr[+a + 1];
                break;
        }
    }
    args[argind].act = act(args[argind].action, args[argind].layer);
    if (args[argind].layer) {
        args[argind].act.layer = args[argind].layer;
    }
    else {
        if (args[argind].action == "bootloader" || args[argind].action == "rgb_change") {
        }
        else {
            throw ('A layer must be specified');
        }
    }
    if (args[argind].process) {
        args[argind].act.process = args[argind].process;
        args[argind].act.timer = setInterval(function () { return args[argind].act.isRunning(); }, 3000);
    }
    else {
        console.log('else');
        args[argind].act.cb();
    }
    console.log(argind, ': ', args[argind]);
};
for (var arg in argvpost) {
    _loop_1(arg);
}
