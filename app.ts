const HID = require('node-hid');
var devices = HID.devices();
const exec = require('child_process').exec;

interface Args {
  process: string,
  action: string,
  layer: number
};

const emptyArgs = (): Args => ({
  process: '',
  action: '',
  layer: 0
});

let args: Args[] = [];

// node app.js --op audiorelay.exe -a layer_on_con -l 1
let argv = process.argv.splice(2, process.argv.length).join(' ');
console.log(argv);
let argvstart = argv.indexOf("--op");
let argvpost = argv.trimStart().split('--op ').slice(argvstart, argv.length);
argvpost = argvpost.splice(1, argvpost.length);
for (let arg in argvpost) {
  console.log('thing: ', argvpost[arg]);
  let argind = args.length + 1;
  args[argind] = emptyArgs();
  console.log(argind);
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
  console.log(args[argind]);
}

/*

const args = process.argv;
let skipnext: boolean = false;

for (let arg in args) {
  if (skipnext) {
    skipnext = false;
    continue;
  } else if (arg == "0" || arg == "1") {
    continue;
  }
  const argn: number = +arg;
  for (let posarg in posargs) {
    if (posargs[posarg].value == "" && args[arg].slice(0, 2) == posargs[posarg].regex.slice(0, 2)) {
      posargs[posarg].value = args[argn + 1];
      skipnext = true;
    }
  }
}
console.log(posargs);

var isRunning = (query: string, cb: Function) => {
  let platform = process.platform;
  let cmd = '';
  switch (platform) {
    case 'win32': cmd = `tasklist`; break;
    case 'darwin': cmd = `ps -ax | grep ${query}`; break;
    case 'linux': cmd = `ps -A`; break;
    default: break;
  }
  exec(cmd, (err, stdout, _stderr) => {
    cb(stdout.toLowerCase().indexOf(query.toLowerCase()) > -1);
  });
}

var device = devices.find((e: any) => {
  return e.vendorId == 43670 && e.productId == 43689 && e.usagePage == 65424 && e.usage == 105
})

var keys = new HID.HID(device.path);

let execute = (action: string) => {
  actions[action].action();
}

interface Action {
  cb: () => boolean;
  action: () => void;
  success: boolean;
}

let act = (action: string): Action => {
  try {
    return Object.create(actions[action]);
  }
  catch (err) {
    throw (err);
  }
}

let actions: { [key: string]: Action } = {
  "layer_on": {
    cb: (): boolean => {
    },
    action: (): void => {
      let lay: number = (Number(getarg("layer").value) & 0xFF);
      console.log("hid write: ", lay, " ", 1);
      keys.write([0x00, lay, 1]);
    },
    success: false
  },
  "layer_on_con": {
    cb: (): boolean => {
    },
    action: () => {
    },
    success: false
  },
  "layer_off": {
    cb: (): boolean => {
    },
    action: () => {
      let lay: number = (Number(getarg("layer").value) & 0xFF);
      console.log("hid write: ", lay, " ", 1);
      keys.write([0x00, lay, 0]);
    },
    success: false
  },
  "layer_switch": {
    cb: (): boolean => {
    },
    action: () => {
    },
    success: false
  }
}


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
