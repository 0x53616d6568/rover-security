#include <Arduino.h>
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"

#include "rover_controller.h"

RoverController rover;

void setup() {
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);  // Disable brownout detector resets
  rover.begin();
}

void loop() {
  rover.update();
}
