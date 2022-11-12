var HID = require('node-hid');
var devices = HID.devices();

var device = devices.find((e) => {
  return e.vendorId == 43670 && e.productId == 43689 && e.usagePage == 65424 && e.usage == 105
})

var keys = new HID.HID(device.path);

keys.write([0x00, 1]);
