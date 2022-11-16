import { rgb2hsv } from "./lib";
const HID = require('node-hid');
var devices = HID.devices();
const exec = require('child_process').exec;

var device = devices.find((e: any) => {
  return e.vendorId == 43670 && e.productId == 43689 && e.usagePage == 65424 && e.usage == 105
})

var keys = new HID.HID(device.path);

interface Operation {
  cb(status?: boolean): void;
  success: boolean;
  timer?: NodeJS.Timer;
  isRunning: Function;
  params?: {
    layer?: number,
    process?: string,
    rgb?: string
  }
}

// Actual messages sent to the HID device
// Format is like this:
// [0x00, reqtype, command, data1, data2, data3]
let actions: { [key: string]: Function } = {
  "layer_on": (lay: number): void => {
    lay = (lay & 0xFF);
    const write = [0x00, 0, 1, lay];
    console.log("hid write: ", write.toString());
    keys.write(write);
  },
  "layer_off": (lay: number): void => {
    lay = (lay & 0xFF);
    const write = [0x00, 0, 0, lay];
    console.log("hid write: ", write.toString());
    keys.write(write);
  },
  "rgb_change": (r: number, g: number, b: number): void => {
    console.log(`rgbnum: (${r},${g},${b})`)
    let hsv = rgb2hsv(r / 255, g / 255, b / 255);
    console.log(`hsvnum: (${hsv[0]},${hsv[1]},${hsv[2]})`)
    let h = hsv[0] / 360;
    h = (h * 255);
    let s = hsv[1] * 255, v = hsv[2] * 255;
    h = (h & 0xFF);
    s = (s & 0xFF);
    v = (v & 0xFF);
    const write = [0x00, 1, 0, h, s, v];
    console.log("hid write: ", write.toString());
    keys.write(write);
  },
  "bootloader": (): void => {
    const write = [0x00, 99, 0, 0];
    console.log('bootloader');
    keys.write(write);
  }
}

// Functions that return custom versions of 'Operation' for different purposes
let ops: { [key: string]: Function } = {
  // If a process was specified then wait till it is on to turn the layer on
  // Otherwise just turn the layer on
  "layer_on": (): Operation => ({
    cb(status?: boolean): void {
      if (status == true) {
        actions["layer_on"](this.params.layer);
        if (this.timer) {
          clearInterval(this.timer);
        }
      } else if (status == undefined) {
        console.log("layeronce");
        actions["layer_on"](this.params.layer);
      }
    },
    isRunning() {
      let platform = process.platform;
      let cmd = '';
      switch (platform) {
        case 'win32': cmd = `tasklist`; break;
        case 'darwin': cmd = `ps -ax | grep ${this.params.process}`; break;
        case 'linux': cmd = `ps -A`; break;
        default: break;
      }
      exec(cmd, (err, stdout, stderr) => {
        this.cb(stdout.toLowerCase().indexOf(this.params.process.toLowerCase()) > -1);
      });
    },
    success: false
  }),
  // Wait to turn the layer on until the application is discovered
  // Then stay active and wait until the application is closed and launched again
  "layer_on_con": (): Operation => ({
    cb(status?: boolean): void {
      if (status == true && !this.success) {
        actions["layer_on"](this.params.layer);
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
        case 'darwin': cmd = `ps -ax | grep ${this.params.process}`; break;
        case 'linux': cmd = `ps -A`; break;
        default: break;
      }
      exec(cmd, (err, stdout, stderr) => {
        this.cb(stdout.toLowerCase().indexOf(this.params.process.toLowerCase()) > -1);
      });
    },
    success: false
  }),
  // If a process was specified then wait till it is on to turn the layer off
  // Otherwise just turn the layer off
  "layer_off": (): Operation => ({
    cb(status?: boolean): void {
      if (status == true) {
        actions["layer_off"](this.params.layer);
        if (this.timer) {
          clearInterval(this.timer);
        }
      } else if (status == undefined) {
        actions["layer_off"](this.params.layer);
      }
    },
    isRunning() {
      let platform = process.platform;
      let cmd = '';
      switch (platform) {
        case 'win32': cmd = `tasklist`; break;
        case 'darwin': cmd = `ps -ax | grep ${this.params.process}`; break;
        case 'linux': cmd = `ps -A`; break;
        default: break;
      }
      exec(cmd, (err, stdout, stderr) => {
        this.cb(stdout.toLowerCase().indexOf(this.params.process.toLowerCase()) > -1);
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
        actions["layer_on"](this.params.layer);
        this.success = true;
      } else if (status == false && this.success) {
        actions["layer_off"](this.params.layer);
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
        case 'darwin': cmd = `ps -ax | grep ${this.params.process}`; break;
        case 'linux': cmd = `ps -A`; break;
        default: break;
      }
      exec(cmd, (err, stdout, stderr) => {
        this.cb(stdout.toLowerCase().indexOf(this.params.process.toLowerCase()) > -1);
      });
    },
    success: false
  }),
  "rgb_change": (): Operation => ({
    cb(status?: boolean): void {
      if ((status == true || status == undefined) && this.params.rgb) {
        const rgb = this.params.rgb.split(',');
        const [r, g, b] = rgb;
        actions["rgb_change"](+r, +g, +b);
      } else if (!this.params.rgb) {
        throw ('Need to specify RGB parameter');
      }
    },
    isRunning() {
      let platform = process.platform;
      let cmd = '';
      switch (platform) {
        case 'win32': cmd = `tasklist`; break;
        case 'darwin': cmd = `ps -ax | grep ${this.params.process}`; break;
        case 'linux': cmd = `ps -A`; break;
        default: break;
      }
      exec(cmd, (err, stdout, stderr) => {
        this.cb(stdout.toLowerCase().indexOf(this.params.process.toLowerCase()) > -1);
      });
    },
    success: false
  }),
  "bootloader": (): Operation => ({
    cb(status?: boolean): void {
      if (status == true || status == undefined) {
        actions["bootloader"]();
      }
    },
    isRunning() {
      let platform = process.platform;
      let cmd = '';
      switch (platform) {
        case 'win32': cmd = `tasklist`; break;
        case 'darwin': cmd = `ps -ax | grep ${this.params.process}`; break;
        case 'linux': cmd = `ps -A`; break;
        default: break;
      }
      exec(cmd, (err, stdout, stderr) => {
        this.cb(stdout.toLowerCase().indexOf(this.params.process.toLowerCase()) > -1);
      });
    },
    success: false
  })
}

let act = (action: string): Operation => {
  try {
    let op = ops[action]();
    op.params = { layer: undefined, process: undefined, rgb: undefined }
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
  rgb: string,
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
      case '-rgb':
        args[argind].rgb = argarr[+a + 1];
        break;
    }
  }
  args[argind].act = act(args[argind].action);

  if (args[argind].layer) {
    args[argind].act.params.layer = args[argind].layer;
  } else {
    if (args[argind].action != "bootloader" && args[argind].action != "rgb_change") {
      throw ('A layer must be specified');
    }
  }

  if (args[argind].rgb) {
    console.log('rgb: ', args[argind].rgb);
    args[argind].act.params.rgb = args[argind].rgb;
  } else {
    if (args[argind].action != "rgb_change") {
      throw ('Need to specify RGB parameter');
    }
  }

  if (args[argind].process) {
    args[argind].act.params.process = args[argind].process;
    args[argind].act.timer = setInterval(() => args[argind].act.isRunning(), 3000);
  } else {
    console.log('else');
    args[argind].act.cb();
  }

  console.log(argind, ': ', args[argind]);
}
