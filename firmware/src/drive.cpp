#include <math.h>

#include "board_config.h"
#include "drive.h"

// Two BTS7960 modules, one per side. Each module takes RPWM (forward) and
// LPWM (reverse); R_EN and L_EN of a module are tied together on one EN pin.

void Drive::begin()
{
  configured_ = board::LEFT_RPWM_PIN >= 0 && board::LEFT_LPWM_PIN >= 0 &&
                board::RIGHT_RPWM_PIN >= 0 && board::RIGHT_LPWM_PIN >= 0 &&
                board::LEFT_EN_PIN >= 0 && board::RIGHT_EN_PIN >= 0;
  if (!configured_) {
    Serial.println("[DRIVE] *** Motor pins NOT configured — drive disabled ***");
    return;
  }

  Serial.println("[DRIVE] Configuring motor pins...");
  Serial.printf("[DRIVE]   LEFT  EN=%d  RPWM=%d  LPWM=%d\n",
                board::LEFT_EN_PIN, board::LEFT_RPWM_PIN, board::LEFT_LPWM_PIN);
  Serial.printf("[DRIVE]   RIGHT EN=%d  RPWM=%d  LPWM=%d\n",
                board::RIGHT_EN_PIN, board::RIGHT_RPWM_PIN, board::RIGHT_LPWM_PIN);
  Serial.printf("[DRIVE]   PWM freq=%dHz  resolution=%d bits\n",
                board::PWM_FREQUENCY_HZ, board::PWM_RESOLUTION_BITS);

  pinMode(board::LEFT_EN_PIN, OUTPUT);
  pinMode(board::RIGHT_EN_PIN, OUTPUT);
  digitalWrite(board::LEFT_EN_PIN, LOW);
  digitalWrite(board::RIGHT_EN_PIN, LOW);

  ledcSetup(board::PWM_CH_LEFT_R, board::PWM_FREQUENCY_HZ, board::PWM_RESOLUTION_BITS);
  ledcSetup(board::PWM_CH_LEFT_L, board::PWM_FREQUENCY_HZ, board::PWM_RESOLUTION_BITS);
  ledcSetup(board::PWM_CH_RIGHT_R, board::PWM_FREQUENCY_HZ, board::PWM_RESOLUTION_BITS);
  ledcSetup(board::PWM_CH_RIGHT_L, board::PWM_FREQUENCY_HZ, board::PWM_RESOLUTION_BITS);
  ledcAttachPin(board::LEFT_RPWM_PIN, board::PWM_CH_LEFT_R);
  ledcAttachPin(board::LEFT_LPWM_PIN, board::PWM_CH_LEFT_L);
  ledcAttachPin(board::RIGHT_RPWM_PIN, board::PWM_CH_RIGHT_R);
  ledcAttachPin(board::RIGHT_LPWM_PIN, board::PWM_CH_RIGHT_L);
  stop();
  Serial.println("[DRIVE] Motors initialized and stopped");
}

void Drive::stop()
{
  if (!configured_)
    return;
  ledcWrite(board::PWM_CH_LEFT_R, 0);
  ledcWrite(board::PWM_CH_LEFT_L, 0);
  ledcWrite(board::PWM_CH_RIGHT_R, 0);
  ledcWrite(board::PWM_CH_RIGHT_L, 0);
  digitalWrite(board::LEFT_EN_PIN, LOW);
  digitalWrite(board::RIGHT_EN_PIN, LOW);
}

void Drive::setSide(int chR, int chL, float value)
{
  const uint32_t duty = static_cast<uint32_t>(fabsf(value) * 255.0F);
  if (value >= 0.0F)
  {
    ledcWrite(chL, 0);
    ledcWrite(chR, duty);
  }
  else
  {
    ledcWrite(chR, 0);
    ledcWrite(chL, duty);
  }
}

bool Drive::setAxes(float forward, float turn)
{
  if (!configured_)
    return false;

  float left = 0.0F;
  float right = 0.0F;

  // If turning in place (pure turn, low forward speed):
  // 4-wheel pivot turn: Left and Right rotate in opposite directions.
  if (fabsf(forward) < 0.10F && fabsf(turn) >= 0.08F)
  {
    left = turn;
    right = -turn;
  }
  else
  {
    // Driving + steering: inside wheels slow down but never stall at 0.
    // All 4 wheels remain active and powered through the turn.
    left = forward + (turn * 0.60F);
    right = forward - (turn * 0.60F);

    const float maxMag = max(fabsf(left), fabsf(right));
    if (maxMag > 1.0F)
    {
      left /= maxMag;
      right /= maxMag;
    }
  }

  // Right side motor inversion: compensates for 180-deg physical mounting
  // so BOTH left and right spin forward together when forward > 0.
  const float rightDrive = -right;

  digitalWrite(board::LEFT_EN_PIN, HIGH);
  digitalWrite(board::RIGHT_EN_PIN, HIGH);
  setSide(board::PWM_CH_LEFT_R, board::PWM_CH_LEFT_L, left);
  setSide(board::PWM_CH_RIGHT_R, board::PWM_CH_RIGHT_L, rightDrive);
  return true;
}

bool Drive::isConfigured() const
{
  return configured_;
}

float Drive::clampAxis(float value) const
{
  return constrain(value, -1.0F, 1.0F);
}
