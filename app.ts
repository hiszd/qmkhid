const HID = require('node-hid');
var devices = HID.devices();
const exec = require('child_process').exec;

interface Operation {
  cb(status?: boolean): void;
  layer?: number;
  process?: string;
  success: boolean;
  timer?: NodeJS.Timer;
  isRunning: Function;
}

// Actual messages sent to the HID device
let actions: { [key: string]: Function } = {
  "layer_on": (lay: number): void => {
    lay = (lay & 0xFF);
    console.log("hid write: ", lay, " ", 1);
    keys.write([0x00, lay, 1]);
  },
  "layer_off": (lay: number): void => {
    lay = (lay & 0xFF);
    console.log("hid write: ", lay, " ", 0);
    keys.write([0x00, lay, 0]);
  },
}

// Functions that return custom versions of 'Operation' for different purposes
let ops: { [key: string]: Function } = {
  // If a process was specified then wait till it is on to turn the layer on
  // Otherwise just turn the layer on
  "layer_on": (): Operation => ({
    cb(status?: boolean): void {
      if (status == true) {
        actions["layer_on"](this.layer);
        if (this.timer) {
          clearInterval(this.timer);
        }
      } else if (status == undefined) {
        actions["layer_on"](this.layer);
      }
    },
    isRunning() {
      let platform = process.platform;
      let cmd = '';
      switch (platform) {
        case 'win32': cmd = `tasklist`; break;
        case 'darwin': cmd = `ps -ax | grep ${this.process}`; break;
        case 'linux': cmd = `ps -A`; break;
        default: break;
      }
      exec(cmd, (err, stdout, stderr) => {
        this.cb(stdout.toLowerCase().indexOf(this.process.toLowerCase()) > -1);
      });
    },
    success: false
  }),
  // Wait to turn the layer on until the application is discovered
  // Then stay active and wait until the application is closed and launched again
  "layer_on_con": (): Operation => ({
    cb(status?: boolean): void {
      if (status == true && !this.success) {
        actions["layer_on"](this.layer);
        this.success = true;
      } else if (status == false && this.success) {
        this.success = false;
      } else if (status == undefined) {
        throw ("Cannot con without process specified")
      }
    },
    isRunning() {
      let platform = process.platform;
      let cmd = '';
      switch (platform) {
        case 'win32': cmd = `tasklist`; break;
        case 'darwin': cmd = `ps -ax | grep ${this.process}`; break;
        case 'linux': cmd = `ps -A`; break;
        default: break;
      }
      exec(cmd, (err, stdout, stderr) => {
        this.cb(stdout.toLowerCase().indexOf(this.process.toLowerCase()) > -1);
      });
    },
    success: false
  }),
  // If a process was specified then wait till it is on to turn the layer off
  // Otherwise just turn the layer off
  "layer_off": (): Operation => ({
    cb(status?: boolean): void {
      if (status == true) {
        actions["layer_off"](this.layer);
        if (this.timer) {
          clearInterval(this.timer);
        }
      } else if (status == undefined) {
        actions["layer_off"](this.layer);
      }
    },
    isRunning() {
      let platform = process.platform;
      let cmd = '';
      switch (platform) {
        case 'win32': cmd = `tasklist`; break;
        case 'darwin': cmd = `ps -ax | grep ${this.process}`; break;
        case 'linux': cmd = `ps -A`; break;
        default: break;
      }
      exec(cmd, (err, stdout, stderr) => {
        this.cb(stdout.toLowerCase().indexOf(this.process.toLowerCase()) > -1);
      });
    },
    success: false
  }),
  // Wait till application is discovered then turn layer on
  // when application is closed then turn the layer off
  // then wait till it is launched again
  "layer_switch": (): Operation => ({
    cb(status?: boolean): void {
      if (status == true && !this.success) {
        actions["layer_on"](this.layer);
        this.success = true;
      } else if (status == false && this.success) {
        actions["layer_off"](this.layer);
        this.success = false;
      } else if (status == undefined) {
        throw ("Cannot switch without process specified")
      }
    },
    isRunning() {
      let platform = process.platform;
      let cmd = '';
      switch (platform) {
        case 'win32': cmd = `tasklist`; break;
        case 'darwin': cmd = `ps -ax | grep ${this.process}`; break;
        case 'linux': cmd = `ps -A`; break;
        default: break;
      }
      exec(cmd, (err, stdout, stderr) => {
        this.cb(stdout.toLowerCase().indexOf(this.process.toLowerCase()) > -1);
      });
    },
    success: false
  })
}

let act = (action: string, layer?: number): Operation => {
  try {
    let op = ops[action]();
    if (layer) op.layer = layer;
    return op;
  }
  catch (err) {
    throw (err);
  }
}

interface Args {
  process: string,
  action: string,
  layer: number,
  act: Operation,
};

let args: Args[] = [];

// node app.js --op -r audiorelay.exe -a layer_on_con -l 1
let argv = process.argv.splice(2, process.argv.length).join(' ');
let argvstart = argv.indexOf("--op");
let argvpost = argv.trimStart().split('--op ').slice(argvstart, argv.length);
argvpost = argvpost.splice(1, argvpost.length);
for (let arg in argvpost) {
  let argind = args.length + 1;
  args[argind] = <Args>{};
  let argarr = argvpost[arg].split(' ');
  for (let a in argarr) {
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
    args[argind].act.timer = setInterval(() => args[argind].act.isRunning(), 3000);
  } else {
    args[argind].act.cb();
  }
  console.log(argind, ': ', args[argind]);
}

var device = devices.find((e: any) => {
  return e.vendorId == 43670 && e.productId == 43689 && e.usagePage == 65424 && e.usage == 105
})

var keys = new HID.HID(device.path);
