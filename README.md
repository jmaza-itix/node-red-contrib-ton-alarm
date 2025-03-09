# ton-alarm for Node-RED #

## Overview

Ton-Alarm is a Node-RED node designed to monitor numerical values and trigger alarms based on configurable thresholds. 

It provides functionality for time-delayed alarm activation and periodic alarm notifications.

## Features
* Configurable optional minimum and maximum thresholds.
* Time delay before an alarm is triggered.
* Optional periodic notifications when an alarm remains active.
* Supports synchronous and asynchronous message sending.
* Reset functionality to clear alarms and timers.

## Usage

1. ### Configure the node
    Set the *minimum* (`minValue`) and *maximum* (`maxValue`) values.
    Define the *timeout* (seconds before an alarm is triggered).
    Optionally set a *repeat* time (interval for repeated alarm notifications).

2. ### Configuration Messages
    This config message overrides the screen configuration of the node
    You only need to send it once
    
    All these parameters are optional. Those not provided will be omited in alarm calculation (except tiemout, that defaults to 60 seconds if not given).

    The node processes incoming messages (`msg`) with the following structure:
    |*Property*  	|*Type*	|*Description*                                                   |
    |-----------|-----------|-----------|
    |`msg.minValue`	|number	|(Optional) Minimum threshold                                    |
    |`msg.maxValue`	|number	|(Optional) Maximum threshold                                    |
    |`msg.timeout`	|number	|(Optional) Time in seconds before an alarm is triggered         |
    |`msg.repeat`	|number	|(Optional) Interval in seconds for repeated alarm notifications |

3. ### Input Messages
   
    The node processes incoming messages (`msg.payload`) as a number or a boolean.
   
    Booleans are converted to `1` (true) or `0` (false).
   
    `msg.payload = "reset"`		Resets the alarm and timers when received as payload.

4. ### Output Messages
    The node has two outputs:
        First output (synchronous messages).
        Second output (asynchronous messages).
    Each output message contains:
    
    ```json
    {
        "payload": true,
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

5. ### First output - sync messages
    These messages are the response to the incoming messages

6. ### Second output - async messages
    These messages are not following incoming messages but the timed events configured

## License
This project is licensed under the MIT License. See the full license in the source code.