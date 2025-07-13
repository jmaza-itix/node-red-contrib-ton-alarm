# ton-alarm for Node-RED #


## Overview

`ton-Alarm` is a Node-RED node designed to monitor numerical values and trigger alarms when values cross configurable thresholds. It supports:
* __Delayed alarm activation__ via timeout
* __Repeat alarm notifications__ while the condition remains active
* __Reset and disable controls__
* __Dual outputs__ for synchronous and asynchronous use cases

This node is ideal for use cases like sensor montioring, process condition alarms, and alert systems in industrial or IoT environments.


## Features
* Configurable __minimum__ and __maximum__ thresholds
* __Timeout__ before triggering the alarm (debounce/filter)
* Optional __repeat interval__ for alarm reminders
* __Synchronous__ (on every message) and asynchronous (on status change) outputs
* __Reset__ and __disable__ capabilities for smarter control logic


## Node Configuration (via editor)
When adding the node in Node-RED, you can configure
* `minValue` (optional): Minimum threshold
* `maxValue` (optional): Maximum threshold
* `timeout` (optional): Delay (in seconds) before alarm activates. __Defaults to 60 seconds__ if not provided
* `repeat` (optional): interval (in seconds) to repeat alarm notifications while active

These settings can be __overridden via incoming config messages__ (see below)


## Dynamic Configuration via Message
You can dynamically override node settings by sending a __configuration message__. This only needs to be sent once, and will persist. You can send it again to modify configuration.

__Message properties (all optional)__:

|*Property*|*Type*|*Description*|
|-----------|-----------|-----------|
|`msg.minValue`|number|Minimum threshold|
|`msg.maxValue`|number|Maximum threshold|
|`msg.timeout`|number|Time (sec) before alarm is triggered|
|`msg.repeat`|number|Interval (sec) for repeated alarm notifications|

> ⚠️ If a property is omitted, it is excluded from alarm calculations (except timeout, which defaults to 60 seconds).

To _delete_ a config value, just assign it a `null` like `msg.MinValue = null`


## Input Messages

### Payload handling:
* `msg.payload`: A __number__ or __boolean__
    * Booleans are converted to `1` (true) or `0` (false).
   
* `msg.payload = "reset"`: Resets alarm state and timers
* `msg.disable = true`: Disables the alarm logic and forces both outputs to emit a "false" state
* `msg.disable = false`: Re-enables the alarm based on the last received value.

Disabling the alarm will set lastValue to _null_. Alarm condition won't be calculated when `msg.disable=false` unless a new msg.payload is received

## Output Messages
The node emits messages on __two outputs__:
1. First output (synchronous):
    * Emitted __on every received message__
    * Useful when periodic or frequent updates are expected
2. __Second output__ (asynchronous):
    * Emitted only on __alarm state change__ or __repeat interval__
    * Useful for flows that only react to changes (e.g. Telegram, email alerts)

### Output message structure:

```json
{
    "payload": true,
    "idDisabled": false,
    "isCondition": true,
    "isAlarmL": false,
    "isAlarmH": true,
    "isSyncMsg": false,
    "isRepeating": true,
    "lastValue": 105.3,
    "minValue": 50,
    "maxValue": 100,
    "timeout": 10,
    "repeat": 30
}
```
|__Field__|__Description__|
|------|------|
|`payload`	|_true_ or _false_, indicating whether alarm condition is active|
|`isDisabled`	|Indicates whether the alarm is currently disabled|
|`isCondition`	|Indicates current condition is outside threshold (before timeout applies)|
|`isAlarmL`	|True if value is below `minValue`|
|`isAlarmH`	|True if value is above `maxValue`|
|`isSyncMsg`	|True if the message was from the synchronous output|
|`isRepeating`	|True if this message is part of the repeating alarm|
|`lastValue`	|The last received value|
|`minValue`	|Current min threshold|
|`maxValue`	|Current max threshold|
|`timeout`	|Configured timeout in seconds|
|`repeat`	|Configured repeat interval in seconds|

### Alarm Disabling Use Case
In some cases, the alarm should be conditionaly disabled. For example, when a device like a cooling chamber is powered off the temperature may rise, but no alarm should be triggered.
* Send `msg.disable = true` to __temporarily disable__ the alarm
    Both outputs will emit a message with `payload = false` and `isDisabled = true`
* Send `msg.disable = false` to __re-enable__ alarm checks


## License
This project is licensed under the MIT License. See the full license in the source code.