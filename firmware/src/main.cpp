#include <Arduino.h>

#include "rover_controller.h"

RoverController rover;

void setup() {
  rover.begin();
}

void loop() {
  rover.update();
}
