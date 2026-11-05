# Security checklist

This is a small classroom demo. The aim is to avoid obvious unsafe or insecure behavior and explain the remaining risks—not to certify a fully secured rover.

## Before the demo

- [ ] Use a local/isolated Wi-Fi or BLE connection. No public internet exposure, port forwarding, or shared cloud credentials.
- [ ] Do not commit passwords, tokens, private keys, or personal information.
- [ ] Allow only the documented command set; validate command names and speed values.
- [ ] Keep a physical power cut-off or motor-disable within reach; test it.
- [ ] Firmware stops when the controller disconnects or stops receiving commands.
- [ ] Dashboard clearly shows disconnected/stopped/fault state.
- [ ] Restrict the demo area and have a spotter.

## Demonstrate

Show that an unknown command is rejected, a command above the speed bound is clamped or rejected, the stop button stops the rover, and disconnecting the controller causes a stop. Record which tests were actually performed.

## Do not claim

Do not claim secure boot, encrypted storage, secure OTA, HMAC-protected commands, resistance to GPS spoofing, standards compliance, or complete security unless the team implemented and verified that exact feature on the actual hardware. The AUC and other detector figures in the supplied material are not evidence for this one-week build. Mention limitations and what would be needed for a production design.
