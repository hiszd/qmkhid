var HID = require('node-hid');
var devices = HID.devices();
var exec = require('child_process').exec;
var actions = {
    "layer_on": function (lay) {
        lay = (lay & 0xFF);
        console.log("hid write: ", lay, " ", 1);
        keys.write([0x00, lay, 1]);
    },
    "layer_off": function (lay) {
        lay = (lay & 0xFF);
        console.log("hid write: ", lay, " ", 1);
        keys.write([0x00, lay, 0]);
    }
};
var ops = {
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
    args[argind].act.layer = args[argind].layer;
    if (args[argind].process) {
        args[argind].act.process = args[argind].process;
        args[argind].act.timer = setInterval(function () { return args[argind].act.isRunning(); }, 3000);
    }
    else {
        args[argind].act.cb();
    }
    console.log(argind, ': ', args[argind]);
};
for (var arg in argvpost) {
    _loop_1(arg);
}
var device = devices.find(function (e) {
    return e.vendorId == 43670 && e.productId == 43689 && e.usagePage == 65424 && e.usage == 105;
});
var keys = new HID.HID(device.path);
/*
// Guts
let proc = getarg("process").value;

if (proc != "") {
  let success: boolean = false;
  let repeat = setInterval(() => {
    isRunning(proc, (status: boolean) => {
      if (actions[getarg("action").value]) {
        let clr = actions[getarg("action").value].cb(success);
        if (clr) clearInterval(repeat);
      } else {
        throw "Action undefined";
      }
    })
  }, 3000);
} else {
  execute(getarg("action").value);
}
*/
