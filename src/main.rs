use hidapi::{DeviceInfo, HidApi};

// set values from config.h
const VENDOR_ID: u16 = 0xAA96;
const PRODUCT_ID: u16 = 0xAAA9;
const USAGE_PAGE: u16 = 0xff60;

fn is_my_device(device: &DeviceInfo) -> bool {
    // if device.vendor_id() == VENDOR_ID && device.product_id() == PRODUCT_ID {
    println!(
        "{:?} {:?} {:?} {:?}",
        device.vendor_id(),
        device.product_id(),
        device.usage_page(),
        device.usage()
    );
    // }
    return device.vendor_id() == VENDOR_ID
        && device.product_id() == PRODUCT_ID
        && device.usage_page() == USAGE_PAGE;
}

fn main() {
    // Do argument parsing to detect what to do
    // [...]
    let command = 0;
    let api = HidApi::new().unwrap_or_else(|e| {
        eprintln!("Error: {}", e);
        std::process::exit(1);
    });

    let device = api
        .device_list()
        .find(|device| is_my_device(device))
        .unwrap_or_else(|| {
            eprintln!("Could not find keyboard");
            std::process::exit(1);
        })
        .open_device(&api)
        .unwrap_or_else(|_| {
            eprintln!("Could not open HID device");
            std::process::exit(1);
        });

    let _ = device.write(&[command, 0]);
    std::process::exit(0);
}

