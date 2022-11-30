import { rgb2hsv } from "./lib";
const HID = require('node-hid');
var devices = HID.devices();
const exec = require('child_process').exec;
const fs = require('fs');

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
    msg?: string
  }
}

// Actual messages sent to the HID device
// Format is like this:
// [0x00, reqtype, command, data1, data2, data3]
let actions: { [key: string]: Function } = {
  "layer_on": (lay: number): void => {
    lay = (lay & 0xFF);
    const write = [0x00, 0, 1, 5, lay];
    console.log("hid write: ", write.toString());
    keys.write(write);
  },
  "layer_off": (lay: number): void => {
    lay = (lay & 0xFF);
    const write = [0x00, 0, 0, 5, lay];
    console.log("hid write: ", write.toString());
    keys.write(write);
  },
  "rgb_change": (r: number, g: number, b: number): void => {
    let hsv = rgb2hsv(r / 255, g / 255, b / 255);
    let h = (hsv[0] / 360) * 255;
    let s = hsv[1] * 255, v = hsv[2] * 255;
    h = (h & 0xFF);
    s = (s & 0xFF);
    v = (v & 0xFF);
    const write = [0x00, 1, 0, 7, h, s, v];
    console.log("hid write: ", write.toString());
    keys.write(write);
  },
  "rgb_all": (r: number, g: number, b: number): void => {
    r = (r & 0xFF);
    g = (g & 0xFF);
    b = (b & 0xFF);
    const write = [0x00, 1, 3, 7, r, g, b];
    console.log("hid write: ", write.toString());
    keys.write(write);
  },
  "rgb_ind": (r: number, g: number, b: number, i: number[]): void => {
    r = (r & 0xFF);
    g = (g & 0xFF);
    b = (b & 0xFF);
    const write = [0x00, 1, 1, (7 + i.length), r, g, b];
    for (let n = 0; n < i.length; n++) {
      write.push(i[n] & 0xFF);
    }
    console.log("hid write: ", write.toString());
    keys.write(write);
  },
  "rgb_notify": (r: number, g: number, b: number): void => {
    let hsv = rgb2hsv(r / 255, g / 255, b / 255);
    let h = (hsv[0] / 360) * 255;
    let s = hsv[1] * 255, v = hsv[2] * 255;
    h = (h & 0xFF);
    s = (s & 0xFF);
    v = (v & 0xFF);
    const write = [0x00, 1, 2, 7, h, s, v];
    console.log("hid write: ", write.toString());
    keys.write(write);
    let oldhsv = keys.readSync().splice(0, 3);
    console.log(oldhsv);
    setTimeout(() => {
      const write = [0x00, 1, 0, 7, oldhsv[0], oldhsv[1], oldhsv[2]];
      console.log("hid write: ", write.toString());
      keys.write(write);
    }, 1000)
  },
  "msg_send": (msg: string): void => {
    const write = [0x00, 2, 0, (3 + msg.length)];
    for (let char = 0; char < msg.length; char++) {
      write.push(msg.charCodeAt(char));
    }
    console.log("hid write: ", write.toString());
    keys.write(write);
  },
  "bootloader": (): void => {
    const write = [0x00, 99, 0, 7];
    console.log('bootloader');
    keys.write(write);
  }
}

function IR(p: string, cb: Function) {
  let platform = process.platform;
  let cmd = '';
  switch (platform) {
    case 'win32': cmd = `tasklist`; break;
    case 'darwin': cmd = `ps -ax | grep ${p}`; break;
    case 'linux': cmd = `ps -A`; break;
    default: break;
  }
  exec(cmd, (err, stdout, stderr) => {
    cb(stdout.toLowerCase().indexOf(p.toLowerCase()) > -1);
  });
}

let layerops = ["layer_on", "layer_off", "layer_switch", "layer_on_con"];

// Functions that return custom versions of 'Operation' for different purposes
let ops: { [key: string]: Function } = {
  // If a process was specified then wait till it is on to turn the layer on
  // Otherwise just turn the layer on
  "layer_on": (): Operation => ({
    cb(status?: boolean): void {
      console.log(this);
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
      IR(this.params.process, this.cb.bind(this));
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
      IR(this.params.process, this.cb.bind(this));
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
      IR(this.params.process, this.cb.bind(this));
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
      IR(this.params.process, this.cb.bind(this));
    },
    success: false
  }),
  "rgb_change": (): Operation => ({
    cb(status?: boolean): void {
      if ((status == true || status == undefined) && this.params.rgb && !this.success) {
        const rgb = this.params.rgb.split(',');
        const [r, g, b] = rgb;
        actions["rgb_change"](+r, +g, +b);
        this.success = true;
        clearInterval(this.timer);
      } else if (!this.params.rgb) {
        throw ('Need to specify RGB parameter');
      }
    },
    isRunning() {
      IR(this.params.process, this.cb.bind(this));
    },
    success: false
  }),
  "rgb_all": (): Operation => ({
    cb(status?: boolean): void {
      if ((status == true || status == undefined) && this.params.rgb && !this.success) {
        const rgb = this.params.rgb.split(',');
        const [r, g, b] = rgb;
        actions["rgb_all"](+r, +g, +b);
        this.success = true;
        clearInterval(this.timer);
      } else if (!this.params.rgb) {
        throw ('Need to specify RGB parameter');
      }
    },
    isRunning() {
      IR(this.params.process, this.cb.bind(this));
    },
    success: false
  }),
  "rgb_ind": (): Operation => ({
    cb(status?: boolean): void {
      if ((status == true || status == undefined) && this.params.rgb && !this.success) {
        const rgbi = this.params.rgb.split(',');
        let [r, g, b, ...i] = rgbi;
        i = i.map((e: any) => {
          return +e;
        })
        console.log(i);
        actions["rgb_ind"](+ r, +g, +b, i);
        this.success = true;
        clearInterval(this.timer);
      } else if (!this.params.rgb) {
        throw ('Need to specify RGB parameter');
      }
    },
    isRunning() {
      IR(this.params.process, this.cb.bind(this));
    },
    success: false
  }),
  "rgb_notify": (): Operation => ({
    cb(status?: boolean): void {
      if ((status == true || status == undefined) && this.params.rgb && !this.success) {
        const rgb = this.params.rgb.split(',');
        const [r, g, b] = rgb;
        actions["rgb_notify"](+r, +g, +b);
        this.success = true;
        clearInterval(this.timer);
      } else if (!this.params.rgb) {
        throw ('Need to specify RGB parameter');
      }
    },
    isRunning() {
      IR(this.params.process, this.cb.bind(this));
    },
    success: false
  }),
  "msg_send": (): Operation => ({
    cb(status?: boolean): void {
      if ((status == true || status == undefined) && this.params.msg && !this.success) {
        actions["msg_send"](this.params.msg);
        this.success = true;
        clearInterval(this.timer);
      } else if (!this.params.msg) {
        throw ('Need to specify message parameter');
      }
    },
    isRunning() {
      IR(this.params.process, this.cb.bind(this));
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
      IR(this.params.process, this.cb.bind(this));
    },
    success: false
  })
}

let act = (action: string): Operation => {
  try {
    let op = ops[action]();
    op.params = { layer: undefined, process: undefined, rgb: undefined, msg: undefined }
    return op;
  }
  catch (err) {
    throw (err);
  }
}

const Action = {
  action: '' as string,
  layer: null as number,
  rgb: '' as string,
  process: '' as string,
  op: <Operation>{}
}
type Action = typeof Action;

const Args = {
  process: '' as string,
  actions: [] as Action[],
}
type Args = typeof Args;

let args: Args[] = [];

// node app.js --op -r audiorelay.exe -a layer_on_con -l 1
let argv = process.argv.splice(2, process.argv.length).join(' ');

let argg = argv.split(' ');
for (let arg in argg) {
  if (argg[arg] == '-c') {
    fs.readFile(argg[+arg + 1], function(err, data: any) {
      const conf = JSON.parse(data).operations;
      for (let op in conf) {
        const curop = conf[op];
        const obj = Args;
        for (let ac in curop.actions) {
          const curac: string = curop.actions[ac].action;
          const curlay: number = curop.actions[ac].layer;
          const currgb: string = curop.actions[ac].rgb;
          const curmsg: string = curop.actions[ac].msg;
          const curact = act(curac);

          if (curlay) {
            console.log('layer: ', curlay);
            curact.params.layer = curlay;
          } else {
            if (layerops.indexOf(curac) != -1) {
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

          if (curmsg) {
            console.log('msg: ', curmsg);
            curact.params.msg = curmsg;
          } else {
            if (curac == "msg_send") {
              throw ('Need to specify message parameter');
            }
          }

          if (curop.process) {
            curact.params.process = curop.process;
            let time = 3000 + (250 * +ac);
            curact.timer = setInterval(() => curact.isRunning(), time);
          } else {
            let time = 0 + (250 * +ac);
            console.log('else');
            setTimeout(curact.cb.bind(curact), time);
          }

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

